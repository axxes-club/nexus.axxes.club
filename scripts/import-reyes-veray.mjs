#!/usr/bin/env node
// Import the Colección Reyes-Veray collection into the Nexus knowledge base.
//
//   node scripts/import-reyes-veray.mjs --dry-run   # report only, write nothing
//   node scripts/import-reyes-veray.mjs             # write
//
// Idempotent, and safe to re-run at any time. Within the target space it:
//   * matches existing pages by title and updates them in place
//   * snapshots a version only when the text actually changed, so a no-op
//     re-run leaves History alone
//   * creates what is missing
//   * soft-deletes pages in the space that this import no longer owns
//   * rebuilds the [[wiki link]] graph from the final text, exactly as
//     savePage() does in the app, so backlinks and the command palette stay
//     correct
//
// Pages are attributed to the organization's owner, so History reads as the
// collection's rather than as a stranger's.
//
// The scale is the reason for the batching: this writes ~4,200 pages and their
// versions, which is far past what one request per row can do inside a
// reasonable time over HTTP. Rows go in multi-row VALUES chunks instead.
//
// Env: DATABASE_URL (falls back to .env.local). Nothing else is needed.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { neon } from "@neondatabase/serverless"
import { buildContent, TENANT_SLUG } from "./reyes-veray-content.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const DRY = process.argv.includes("--dry-run")

/** Rows per statement. Postgres caps a bind message well above this. */
const CHUNK = 40

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

// Mirrors linkedTitlesOutsideCode() in src/lib/nexus/links.ts: a [[link]] only
// counts when it is not inside a code span or a fenced block.
const WIKI_LINK = /\[\[([^\]|]{1,200})(?:\|([^\]]{1,200}))?\]\]/g
function linkedTitles(content) {
  const outside = content.replace(/```[\s\S]*?```|`[^`\n]*`/g, "")
  const titles = new Set()
  for (const m of outside.matchAll(WIKI_LINK)) titles.add(m[1].trim().toLowerCase())
  return titles
}

/** Run `fn` over `items` in fixed-size chunks. */
async function chunked(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size))
}

/**
 * Retry a write that failed for a transient reason.
 *
 * The database is reached over HTTPS from a laptop, and the pooled endpoint
 * drops the occasional connection — a connect timeout part-way through a
 * multi-thousand-row import is survivable, because every write here is
 * idempotent and keyed on the page title. Retrying is therefore always safe.
 *
 * Only transport-level failures are retried. A constraint violation or a bad
 * statement fails the same way the second time, and hiding that behind a retry
 * would just make the real error slower to surface.
 */
async function retry(fn, { attempts = 5, label = "query" } = {}) {
  let lastError
  for (let n = 1; n <= attempts; n++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const transient =
        error?.code === "UND_ERR_CONNECT_TIMEOUT" ||
        error?.code === "ECONNRESET" ||
        error?.code === "ETIMEDOUT" ||
        error?.code === "EPIPE" ||
        error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
        /timeout|socket hang up|network|fetch failed/i.test(String(error?.message ?? ""))
      if (!transient || n === attempts) throw error
      const wait = 1000 * n
      console.log(`  (${label} hit a connection error, retrying in ${wait}ms — ${n}/${attempts - 1})`)
      await new Promise((resolve) => setTimeout(resolve, wait))
    }
  }
  throw lastError
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validate a list of ids and return it ready to bind as a `uuid[]` parameter.
 *
 * Every id here was read back out of the database by this script, and each is
 * checked against the UUID shape, so a value that is not an id is a bug rather
 * than an injection. Binding the array through `= any($1::uuid[])` is what
 * keeps it that way: nothing is ever spliced into the SQL text.
 */
function uuidArray(ids) {
  const clean = [...new Set(ids)]
  for (const id of clean) {
    if (typeof id !== "string" || !UUID.test(id)) throw new Error(`Refusing to bind non-UUID id: ${id}`)
  }
  if (!clean.length) throw new Error("Refusing to run an IN () over an empty list")
  return clean
}

const sql = neon(databaseUrl())

/** Pages are attributed to the org's owner, so History reads as the collection's. */
async function authorFor(tenantId) {
  const [owner] = await sql`select owner_id from tenants where id = ${tenantId}`
  if (owner?.owner_id) return owner.owner_id
  const [admin] = await sql`
    select user_id from tenant_memberships
    where tenant_id = ${tenantId} and deleted_at is null
    order by is_primary desc limit 1`
  if (!admin) throw new Error(`No owner or member found for organization ${TENANT_SLUG}`)
  return admin.user_id
}

/** Everything this import has touched, for the final link pass. */
const written = []

/**
 * Write one space: resolve it, plan its pages, create, reconcile, snapshot and
 * retire what it no longer owns.
 */
async function writeSpace(space, { tenantId, authorId }) {
  const label = space.icon ? `${space.icon} ${space.name}` : space.name

  // --- resolve the space, creating it only if the org has none by that name ---
  const [existing] = await sql`
    select id from nexus_spaces
    where tenant_id = ${tenantId} and lower(name) = lower(${space.name}) and deleted_at is null
    limit 1`

  let spaceId = existing?.id ?? null
  if (DRY && !spaceId) spaceId = "00000000-0000-0000-0000-000000000000"

  if (!spaceId) {
    const [created] = await sql`
      insert into nexus_spaces (tenant_id, name, icon, description, created_by_id)
      values (${tenantId}, ${space.name}, ${space.icon}, ${space.description}, ${authorId})
      returning id`
    spaceId = created.id
    console.log(`  created the space`)
  } else if (!DRY) {
    await sql`update nexus_spaces set icon = ${space.icon}, description = ${space.description} where id = ${spaceId}`
  }

  // Read even in a dry run: a report that cannot say what would be retired is
  // not much of a report.
  const existingPages = await sql`
    select id, title, content, parent_id, position, icon
    from nexus_pages
    where space_id = ${spaceId} and deleted_at is null`
  const byTitle = new Map(existingPages.map((p) => [String(p.title).toLowerCase(), p]))

  // --- plan, parents before children ---
  const plan = []
  const seenTitles = new Set()
  // Position is the order among siblings, so counting per parent keeps the
  // sidebar in the order the content lists things.
  const siblingCount = new Map()

  for (const page of space.pages) {
    const titleKey = page.title.toLowerCase()
    if (seenTitles.has(titleKey)) {
      throw new Error(`Duplicate page title in ${space.name}: "${page.title}"`)
    }
    seenTitles.add(titleKey)

    const parentKey = page.parent ? String(page.parent).toLowerCase() : null
    const position = siblingCount.get(parentKey) ?? 0
    siblingCount.set(parentKey, position + 1)

    const prior = byTitle.get(titleKey)
    plan.push({
      title: page.title,
      icon: page.icon ?? null,
      content: page.content,
      parentTitle: page.parent ?? null,
      parentKey,
      position,
      prior,
      id: prior?.id ?? null,
      spaceId,
    })
  }

  const toCreate = plan.filter((p) => !p.id)
  let created = 0
  let updated = 0
  let stale = []

  if (!DRY) {
    // --- create, in chunks. parent_id is filled in by the reconcile pass: a
    // page created a moment ago has no id for a child to point at yet.
    await chunked(toCreate, CHUNK, async (batch) => {
      const values = []
      const params = []
      batch.forEach((p, n) => {
        const b = n * 9
        values.push(
          `($${b + 1}::uuid, $${b + 2}::uuid, $${b + 3}::uuid, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}::int, $${b + 8}, $${b + 9})`,
        )
        params.push(tenantId, spaceId, null, p.title, p.icon, p.content, p.position, authorId, authorId)
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

    // --- reconcile structure and text ---
    // Comparing parent and position as well as title and content is what makes
    // a re-run a genuine no-op: a page whose text is current but whose parent
    // is not still has to be moved.
    const idByTitleLower = new Map(plan.map((p) => [p.title.toLowerCase(), p.id]))
    const missing = plan.filter((p) => !p.id)
    if (missing.length) throw new Error(`${space.name}: ${missing.length} page(s) have no id (e.g. "${missing[0].title}")`)

    const toUpdate = []
    for (const item of plan) {
      item.parentId = item.parentKey ? idByTitleLower.get(item.parentKey) ?? null : null
      if (item.parentKey && !item.parentId) {
        throw new Error(`"${item.title}" names a missing parent "${item.parentTitle}" in ${space.name}`)
      }
      const prior = item.prior
      const drifted =
        !prior ||
        prior.content !== item.content ||
        (prior.icon ?? null) !== item.icon ||
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
        params.push(p.id, p.parentId, p.title, p.icon, p.content, p.position, authorId)
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

    // --- version history ---
    // Every page this import touched keeps the text it now holds, so History is
    // never empty and a restore has somewhere to go.
    const touched = [...toCreate, ...toUpdate]
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
          sql.query(
            `insert into nexus_page_versions (page_id, title, content, author_id) values ${values.join(", ")}`,
            params,
          ),
        { label: "snapshot versions" },
      )
    })

    // --- soft-delete what this import no longer owns in this space ---
    const kept = new Set(plan.map((p) => p.id))
    stale = existingPages.filter((p) => !kept.has(p.id))
    if (stale.length) {
      const ids = uuidArray(stale.map((p) => p.id))
      await sql.query(`update nexus_pages set deleted_at = now() where id = any($1::uuid[])`, [ids])
      await sql.query(
        `delete from nexus_links
          where from_page_id = any($1::uuid[]) or to_page_id = any($1::uuid[])`,
        [ids],
      )
    }
  } else {
    // Nothing was written, but the report still has to say what a real run
    // would retire — the old single-space layout is mostly about to be.
    const kept = new Set(plan.map((p) => p.id))
    stale = existingPages.filter((p) => !kept.has(p.id))
  }

  written.push(...plan)
  return { spaceId, label, planned: plan.length, toCreate: toCreate.length, created, updated, stale, byTitle }
}
async function main() {
  const content = await buildContent(sql)
  const { tenantId, spaces, stats } = content

  console.log(`Organisation : ${content.tenantName}`)
  console.log(
    `Content      : ${spaces.reduce((n, s) => n + s.pages.length, 0)} pages across ${spaces.length} spaces — ` +
      `${stats.artists} artists, ${stats.artworks} works, ${stats.architecture} projects, ` +
      `${stats.publications} publications, ${stats.images} images`,
  )
  if (content.unknownBlockTypes.length) {
    console.log(`Unrendered CMS blocks: ${content.unknownBlockTypes.join(", ")}`)
  }
  if (content.ambiguousArchitecture.length) {
    console.log(
      `Heads up     : ${content.ambiguousArchitecture.length} project(s) were filed on a weak signal and are worth a look:`,
    )
    console.log(`               ${content.ambiguousArchitecture.slice(0, 12).join(", ")}`)
  }

  const authorId = await authorFor(tenantId)

  // --- write every space ---
  const results = []
  for (const space of spaces) {
    const result = await writeSpace(space, { tenantId, authorId })
    results.push(result)
    if (DRY) {
      console.log(`${result.label.padEnd(38)} ${String(result.planned).padStart(5)} pages planned`)
    } else {
      console.log(
        `${result.label.padEnd(38)} ${String(result.planned).padStart(5)} pages  ` +
          `(+${result.created} new, ${result.updated} written, ${result.stale.length} retired)`,
      )
    }
  }

  // --- links resolve across the whole tenant, so the graph is built last ---
  // Every title this import defines, across all three spaces.
  const plannedTitles = new Set(written.map((p) => p.title.toLowerCase()))
  const dangling = new Map()
  let referenceCount = 0
  for (const item of written) {
    for (const title of linkedTitles(item.content)) {
      referenceCount++
      if (!plannedTitles.has(title)) dangling.set(title, (dangling.get(title) ?? 0) + 1)
    }
  }

  console.log(`Links        : ${referenceCount} [[references]]`)
  if (dangling.size) {
    console.log(`              ${dangling.size} title(s) are linked but never defined:`)
    for (const [title, n] of [...dangling].slice(0, 15)) console.log(`                - [[${title}]] (x${n})`)
  } else {
    console.log("              every [[link]] resolves to a page in this import")
  }

  if (DRY) {
    console.log("")
    for (const result of results) {
      console.log(
        `[dry run] ${result.label}: ${result.byTitle.size} page(s) present, ` +
          `${result.toCreate} would be new, ${result.stale.length} would be retired`,
      )
    }
    return
  }

  // --- rebuild the graph from the final text ---
  // Done in one pass over everything this import owns, so a page that moved
  // space or was renamed cannot leave a stale edge behind.
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
    await retry(
      () =>
        sql.query(
          `insert into nexus_links (from_page_id, to_page_id) values ${values.join(", ")} on conflict do nothing`,
          params,
        ),
      { label: "insert links" },
    )
  })

  const totalCreated = results.reduce((n, r) => n + r.created, 0)
  const totalUpdated = results.reduce((n, r) => n + r.updated, 0)
  const totalStale = results.reduce((n, r) => n + r.stale.length, 0)
  console.log(
    `\n${totalCreated} created, ${totalUpdated} written, ${totalStale} retired, ${rows.length} links.`,
  )
  for (const result of results) {
    console.log(`  ${result.label} -> https://nexus.axxes.club/dashboard/s/${result.spaceId}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
