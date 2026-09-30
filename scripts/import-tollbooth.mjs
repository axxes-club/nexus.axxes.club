#!/usr/bin/env node
// Import the Tollbooth documentation space into Nexus.
//
//   node scripts/import-tollbooth.mjs --dry-run   # report only, write nothing
//   node scripts/import-tollbooth.mjs             # write
//
// Idempotent, and safe to re-run at any time. Within the target space it:
//   * resolves the space by name, creating it only if the org has none
//   * matches pages by title and updates them in place
//   * snapshots a version only when the text actually changed, so a no-op re-run
//     leaves History alone
//   * creates what is missing, and soft-deletes pages it no longer owns
//   * rebuilds the [[wiki link]] graph from the final text, exactly as savePage()
//     does in the app, so backlinks and the command palette stay correct
//
// It also refuses to run if any of its titles already exists elsewhere in the
// organisation. Nexus resolves [[links]] by title across the whole tenant, so a
// duplicate title would silently merge this page into another space's page.
//
// Env: DATABASE_URL (falls back to .env.local). Nothing else is needed.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { neon } from "@neondatabase/serverless"
import { buildContent } from "./tollbooth-content.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const DRY = process.argv.includes("--dry-run")
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const env = readFileSync(join(HERE, "..", ".env.local"), "utf8")
  for (const line of env.split("\n")) {
    if (line.startsWith("DATABASE_URL=")) {
      return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "")
    }
  }
  throw new Error("DATABASE_URL not set and not found in .env.local")
}

/** Postgres caps a bind message well above this, and 17 pages fit in one. */
const CHUNK = 40

/**
 * Retry a write that failed for a transient reason.
 *
 * The database is reached over HTTPS from a laptop and the pooled endpoint drops
 * the occasional connection. Every write here is idempotent and keyed on the page
 * title, so retrying is safe. Only transport-level failures are retried: a
 * constraint violation fails the same way the second time, and hiding that behind a
 * retry would only make the real error slower to surface.
 */
async function retry(fn, { attempts = 5, label = "query" } = {}) {
  let lastError
  for (let n = 1; n <= attempts; n++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const transient =
        error?.code === "ECONNRESET" ||
        error?.code === "ETIMEDOUT" ||
        error?.code === "ECONNREFUSED" ||
        error?.code === "ENOTFOUND" ||
        error?.code === "57P01" || // admin_shutdown
        error?.code === "57P02" || // crash_shutdown
        error?.code === "57P03" || // cannot_connect_now
        error?.code === "40001" || // serialization_failure
        error?.code === "40P01" // deadlock_detected
      if (!transient || n === attempts) throw error
      await new Promise((r) => setTimeout(r, 250 * n))
    }
  }
  throw lastError
}

/** Mirrors linkedTitlesOutsideCode() in src/lib/nexus/links.ts. */
const WIKI_LINK = /\[\[([^\]|]{1,200})(?:\|([^\]]{1,200}))?\]\]/g
function linkedTitles(content) {
  const outside = content.replace(/```[\s\S]*?```|`[^`\n]*`/g, "")
  const titles = new Set()
  for (const m of outside.matchAll(WIKI_LINK)) titles.add(m[1].trim().toLowerCase())
  return titles
}

function uuidArray(ids) {
  const clean = [...new Set(ids)]
  for (const id of clean) {
    if (typeof id !== "string" || !UUID.test(id)) throw new Error(`Refusing to bind non-UUID id: ${id}`)
  }
  if (!clean.length) throw new Error("Refusing to run an IN () over an empty list")
  return clean
}

async function chunked(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size))
}

const sql = neon(databaseUrl())

/** Pages are attributed to the org's owner, so History reads as ours. */
async function authorFor(tenantId) {
  const [owner] = await sql`select owner_id from tenants where id = ${tenantId}`
  if (owner?.owner_id) return owner.owner_id
  const [admin] = await sql`
    select user_id from tenant_memberships
    where tenant_id = ${tenantId} and deleted_at is null
    order by is_primary desc limit 1`
  if (!admin) throw new Error("No owner or member found for the organisation")
  return admin.user_id
}

const written = []

async function main() {
  const { space, pages, tenantSlug } = buildContent()

  const [tenant] = await sql`select id, name from tenants where slug = ${tenantSlug} and deleted_at is null limit 1`
  if (!tenant) throw new Error(`No tenant with slug "${tenantSlug}"`)
  const tenantId = tenant.id

  console.log(`Organisation : ${tenant.name}`)
  console.log(`Space        : ${space.icon} ${space.name} — ${pages.length} pages`)

  // --- guard against a title that already means another page ---------------
  // Links resolve by title across the tenant, so a collision would quietly point
  // this space's links at somebody else's page and merge the two.
  // `query()` with an explicit ::text[] cast: neon will not expand a JS array in a
  // tagged template, and an empty one is legal here rather than an error.
  const wantedTitles = pages.map((p) => p.title.toLowerCase())
  const existingElsewhere = await sql.query(
    `select p.title, s.name as space
       from nexus_pages p
       join nexus_spaces s on s.id = p.space_id
      where p.tenant_id = $1
        and p.deleted_at is null
        and s.name <> $2
        and lower(p.title) = any($3::text[])`,
    [tenantId, space.name, wantedTitles],
  )
  if (existingElsewhere.length) {
    console.log("\nRefusing to import. These titles already exist in another space of this")
    console.log("organisation, and a [[link]] to them would resolve to the wrong page:")
    for (const row of existingElsewhere) console.log(`  - "${row.title}" is in ${row.space}`)
    process.exitCode = 1
    return
  }

  // --- plan ---------------------------------------------------------------
  const seen = new Set()
  for (const page of pages) {
    const key = page.title.toLowerCase()
    if (seen.has(key)) throw new Error(`Duplicate page title: "${page.title}"`)
    seen.add(key)
    if (page.parent && !pages.some((p) => p.title.toLowerCase() === page.parent.toLowerCase())) {
      throw new Error(`"${page.title}" names a missing parent "${page.parent}"`)
    }
  }

  // --- resolve or create the space ---------------------------------------
  const [existingSpace] = await sql`
    select id from nexus_spaces
    where tenant_id = ${tenantId} and lower(name) = lower(${space.name}) and deleted_at is null
    limit 1`

  let spaceId = existingSpace?.id ?? null
  if (DRY && !spaceId) spaceId = "00000000-0000-0000-0000-000000000000"

  if (!spaceId) {
    const [created] = await sql`
      insert into nexus_spaces (tenant_id, name, icon, description, created_by_id)
      values (${tenantId}, ${space.name}, ${space.icon}, ${space.description}, ${authorFor})
      returning id`
    spaceId = created.id
  } else if (!DRY) {
    await sql`update nexus_spaces set icon = ${space.icon}, description = ${space.description} where id = ${spaceId}`
  }

  // Read even in a dry run: a report that cannot say what it would retire is not
  // much of a report.
  const existingPages = await sql`
    select id, title, content, parent_id, position, icon
    from nexus_pages
    where space_id = ${spaceId} and deleted_at is null`
  const byTitle = new Map(existingPages.map((p) => [String(p.title).toLowerCase(), p]))

  const authorId = await authorFor(tenantId)

  // Position is the order among siblings, so counting per parent keeps the
  // sidebar in the order the content lists things.
  const siblingCount = new Map()
  const plan = pages.map((page) => {
    const parentKey = page.parent ? page.parent.toLowerCase() : null
    const position = siblingCount.get(parentKey) ?? 0
    siblingCount.set(parentKey, position + 1)
    const prior = byTitle.get(page.title.toLowerCase())
    return { ...page, parentKey, position, prior, id: prior?.id ?? null, spaceId }
  })

  let created = 0
  let updated = 0
  let stale = []

  if (!DRY) {
    const toCreate = plan.filter((p) => !p.id)
    await chunked(toCreate, CHUNK, async (batch) => {
      const values = []
      const params = []
      batch.forEach((p, n) => {
        const b = n * 9
        values.push(
          `($${b + 1}::uuid, $${b + 2}::uuid, $${b + 3}::uuid, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}::int, $${b + 8}, $${b + 9})`,
        )
        params.push(tenantId, spaceId, null, p.title, p.icon ?? null, p.content, p.position, authorId, authorId)
      })
      const rows = await retry(
        () =>
          sql.query(
            `insert into nexus_pages
               (tenant_id, space_id, parent_id, title, icon, content, position, created_by_id, updated_by_id)
             values ${values.join(", ")}
             returning id, title`,
            params,
          ),
        { label: "insert pages" },
      )
      for (const row of rows) {
        const item = batch.find((p) => p.title === row.title)
        if (item) item.id = row.id
      }
      created += rows.length
    })

    // Reconcile structure and text. Comparing parent and position as well as title
    // and content is what makes a re-run a genuine no-op.
    const idByTitleLower = new Map(plan.map((p) => [p.title.toLowerCase(), p.id]))
    const missing = plan.filter((p) => !p.id)
    if (missing.length) throw new Error(`${missing.length} page(s) have no id (e.g. "${missing[0].title}")`)

    const toUpdate = []
    for (const item of plan) {
      item.parentId = item.parentKey ? idByTitleLower.get(item.parentKey) ?? null : null
      if (item.parentKey && !item.parentId) {
        throw new Error(`"${item.title}" names a missing parent "${item.parent}"`)
      }
      const prior = item.prior
      const drifted =
        !prior ||
        prior.content !== item.content ||
        (prior.icon ?? null) !== (item.icon ?? null) ||
        (prior.parent_id ?? null) !== item.parentId ||
        prior.position !== item.position
      if (drifted) toUpdate.push(item)
    }

    await chunked(toUpdate, CHUNK, async (batch) => {
      const values = []
      const params = []
      batch.forEach((p, n) => {
        const b = n * 7
        values.push(`($${b + 1}::uuid, $${b + 2}::uuid, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}::int, $${b + 7})`)
        params.push(p.id, p.parentId, p.title, p.icon ?? null, p.content, p.position, authorId)
      })
      await retry(
        () =>
          sql.query(
            `update nexus_pages p
                set title = v.title, icon = v.icon, content = v.content,
                    parent_id = v.parent_id, position = v.position,
                    updated_by_id = v.author, updated_at = now()
               from (values ${values.join(", ")}) as v(id, parent_id, title, icon, content, position, author)
              where p.id = v.id`,
            params,
          ),
        { label: "update pages" },
      )
      updated += batch.length
    })

    // Version history. Every page this import touched keeps the text it now holds,
    // so History is never empty and a restore has somewhere to go.
    //
    // `toUpdate` already contains the pages just created — a page with no prior row
    // is "drifted" by definition — so including `toCreate` again would write two
    // identical history entries for every new page.
    const touched = toUpdate
    await chunked(touched, CHUNK, async (batch) => {
      const values = []
      const params = []
      batch.forEach((p, n) => {
        const b = n * 4
        values.push(`($${b + 1}::uuid, $${b + 2}, $${b + 3}, $${b + 4})`)
        params.push(p.id, p.title, p.content, authorId)
      })
      await retry(
        () =>
          sql.query(`insert into nexus_page_versions (page_id, title, content, author_id) values ${values.join(", ")}`, params),
        { label: "snapshot versions" },
      )
    })

    // Soft-delete what this import no longer owns in this space.
    const kept = new Set(plan.map((p) => p.id))
    stale = existingPages.filter((p) => !kept.has(p.id))
    if (stale.length) {
      const ids = uuidArray(stale.map((p) => p.id))
      await sql.query(`update nexus_pages set deleted_at = now() where id = any($1::uuid[])`, [ids])
      await sql.query(
        `delete from nexus_links where from_page_id = any($1::uuid[]) or to_page_id = any($1::uuid[])`,
        [ids],
      )
    }
  } else {
    const kept = new Set(plan.map((p) => p.id))
    stale = existingPages.filter((p) => !kept.has(p.id))
  }

  written.push(...plan)

  // --- links resolve across the whole tenant, so the graph is built last ---
  const plannedTitles = new Set(written.map((p) => p.title.toLowerCase()))
  const dangling = new Map()
  let referenceCount = 0
  for (const item of written) {
    for (const title of linkedTitles(item.content)) {
      referenceCount++
      if (!plannedTitles.has(title)) dangling.set(title, (dangling.get(title) ?? 0) + 1)
    }
  }

  console.log(`Pages        : ${plan.length} (${plan.filter((p) => !p.prior).length} new, ${plan.filter((p) => p.prior).length} present)`)
  console.log(`Links        : ${referenceCount} [[references]]`)
  if (dangling.size) {
    // A link to a page that exists elsewhere in the tenant is fine and intended;
    // only a link to nothing at all is worth reporting.
    const elsewhere = new Map()
    if (dangling.size) {
      const rows = await sql.query(
        `select lower(p.title) as title, s.name as space
           from nexus_pages p join nexus_spaces s on s.id = p.space_id
          where p.tenant_id = $1 and p.deleted_at is null
            and lower(p.title) = any($2::text[])`,
        [tenantId, [...dangling.keys()]],
      )
      for (const row of rows) elsewhere.set(row.title, row.space)
    }
    const unknown = [...dangling].filter(([title]) => !elsewhere.has(title))
    for (const [title, space] of elsewhere) {
      console.log(`              [[${title}]] resolves into ${space}`)
    }
    for (const [title, n] of unknown) {
      console.log(`              [[${title}]] (x${n}) resolves to nothing — rendered as a "create this page" link`)
    }
  } else {
    console.log("              every [[link]] resolves inside this space")
  }

  if (DRY) {
    console.log(`\n[dry run] nothing was written. ${space.name}: ${plan.length} page(s) planned, ${stale.length} would be retired.`)
    return
  }

  // --- rebuild the graph from the final text ---
  // One pass over everything this import owns, so a page that moved or was renamed
  // cannot leave a stale edge behind.
  const idByTitleLower = new Map(written.map((p) => [p.title.toLowerCase(), p.id]))
  const rows = []
  for (const item of written) {
    for (const title of linkedTitles(item.content)) {
      const to = idByTitleLower.get(title)
      if (to && to !== item.id) rows.push({ from: item.id, to })
    }
  }

  const managed = uuidArray(written.map((p) => p.id))
  await retry(() => sql.query(`delete from nexus_links where from_page_id = any($1::uuid[])`, [managed]), {
    label: "clear links",
  })
  await chunked(rows, 200, async (batch) => {
    const values = []
    const params = []
    batch.forEach((r, n) => {
      values.push(`($${n * 2 + 1}::uuid, $${n * 2 + 2}::uuid)`)
      params.push(r.from, r.to)
    })
    if (!values.length) return
    await retry(
      () =>
        sql.query(`insert into nexus_links (from_page_id, to_page_id) values ${values.join(", ")} on conflict do nothing`, params),
      { label: "insert links" },
    )
  })

  console.log(`\n${created} created, ${updated} written, ${stale.length} retired, ${rows.length} links.`)
  console.log(`  https://nexus.axxes.club/dashboard/s/${spaceId}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
