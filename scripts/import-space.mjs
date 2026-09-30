#!/usr/bin/env node
// The shared engine behind every space importer in this folder.
//
//   node scripts/import-space.mjs <content-module.mjs> [--dry-run]
//   node scripts/import-space.mjs tollbooth-content.mjs --dry-run
//
// Each space's words live in its own *-content.mjs, which exports:
//
//   SPACE = { name, icon, description }
//   PAGES = [ { title, icon, content, parent? }, ... ]   // parent is a page title
//   TENANT = { slug }                                    // an org that already exists
//   or CREATE_TENANT = { name, slug, type, website, ... } // an org to create if absent
//
// Idempotent, and safe to re-run at any time. Within the target space it:
//   * resolves the org by slug, creating it (and your membership) only if absent
//   * resolves the space by name, creating it only if the org has none
//   * matches pages by title and updates them in place
//   * snapshots a version only when the text actually changed, so a no-op re-run
//     leaves History alone
//   * creates what is missing, and soft-deletes pages it no longer owns
//   * rebuilds the [[wiki link]] graph from the final text, exactly as savePage()
//     does in the app, so backlinks and the command palette stay correct
//
// It also refuses to run if any of its titles already exists elsewhere in the
// org. Nexus resolves [[links]] by title across the whole tenant, so a duplicate
// title would silently merge this page into another space's page.
//
// Env: DATABASE_URL (falls back to .env.local). Nothing else is needed.

import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { neon } from "@neondatabase/serverless"

const HERE = dirname(fileURLToPath(import.meta.url))
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The account that owns any org this script creates. */
const OWNER_EMAIL = "viscasillas@me.com"

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

/**
 * Retry a write that failed for a transient reason.
 *
 * The database is reached over HTTPS from a laptop and the pooled endpoint drops
 * the occasional connection. Every write here is idempotent and keyed on the page
 * title, so retrying is safe. Only transport-level failures are retried: a
 * constraint violation fails the same way the second time, and hiding that behind
 * a retry would only make the real error slower to surface.
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

/** Pages are attributed to the org's owner, so History reads as ours. */
async function authorFor(sql, tenantId) {
  const [owner] = await sql`select owner_id from tenants where id = ${tenantId}`
  if (owner?.owner_id) return owner.owner_id
  const [admin] = await sql`
    select user_id from tenant_memberships
    where tenant_id = ${tenantId} and deleted_at is null
    order by is_primary desc limit 1`
  if (!admin) throw new Error("No owner or member found for the organisation")
  return admin.user_id
}

/**
 * Find the org, creating it if the content module asks us to.
 *
 * A new org is not useful without a membership: every page in Nexus is read
 * through a tenant membership, so an org nobody belongs to is invisible in the
 * switcher and unreachable. The owner is resolved by email rather than a hard
 * coded id, so the script keeps working if the account is ever recreated.
 */
async function resolveTenant(sql, { tenant, createTenant }, dry) {
  const [row] = await sql`select id, name, slug from tenants where slug = ${tenant.slug} and deleted_at is null limit 1`
  if (row) return row

  if (!createTenant) {
    throw new Error(
      `No organisation with slug "${tenant.slug}". Create it first, or add CREATE_TENANT to the content module.`,
    )
  }

  const [me] = await sql`select id, name, email from "user" where lower(email) = lower(${OWNER_EMAIL}) limit 1`
  if (!me) throw new Error(`No Nexus account with email ${OWNER_EMAIL}; cannot own a new organisation`)

  console.log(`Organisation "${createTenant.name}" (${tenant.slug}) does not exist yet`)
  if (dry) return { id: null, name: createTenant.name, slug: tenant.slug, pending: true }

  const [created] = await sql`
    insert into tenants (name, slug, type, status, owner_id, email, website, primary_color)
    values (${createTenant.name}, ${tenant.slug}, ${createTenant.type ?? "business"},
            ${createTenant.status ?? "active"}, ${me.id}, ${createTenant.email ?? me.email},
            ${createTenant.website ?? null}, ${createTenant.primaryColor ?? null})
    returning id, name, slug`
  // Owner membership, and primary, so the switcher lands here first.
  await sql`
    insert into tenant_memberships (tenant_id, user_id, role, is_primary)
    values (${created.id}, ${me.id}, ${"owner"}, ${true})
    on conflict do nothing`
  console.log(`  created, owned by ${me.name} <${me.email}>`)
  return created
}

/**
 * The whole reconcile, for one space. `spec` is what a *-content.mjs exports:
 * { space, pages, tenant } and optionally `createTenant`.
 *
 * Older content modules (tollbooth, reyes-veray) instead export a bare
 * `TENANT_SLUG` string and a `buildContent()` function, so both shapes are
 * accepted here and normalised before anything else looks at them.
 */
export async function importSpace(mod, { dry = false } = {}) {
  const spec = typeof mod.buildContent === "function" ? mod.buildContent() : mod
  // Content modules export the constants in CAPS, matching the older
  // tollbooth/reyes-veray modules, so both spellings are accepted.
  const space = spec.SPACE ?? spec.space
  const pages = spec.PAGES ?? spec.pages
  const tenant = spec.TENANT ?? spec.tenant ?? (mod.TENANT_SLUG ? { slug: mod.TENANT_SLUG } : null)
  if (!space || !Array.isArray(pages) || !tenant) {
    throw new Error(
      `Content module must export SPACE, PAGES and TENANT (or TENANT_SLUG). Got: ${Object.keys(spec).join(", ") || "nothing"}`,
    )
  }
  const createTenant = spec.CREATE_TENANT ?? spec.createTenant
  const sql = neon(databaseUrl())

  const org = await resolveTenant(sql, { tenant, createTenant }, dry)
  console.log(`Organisation : ${org.name} (${org.slug})`)
  console.log(`Space        : ${space.icon} ${space.name} — ${pages.length} pages`)

  if (org.pending) {
    console.log("\n[dry run] nothing was written. The organisation does not exist yet, so the")
    console.log("          page contents could not be compared against what is really there.")
    return
  }
  const tenantId = org.id

  // --- guard against a title that already means another page ------------------
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
    throw new Error("Title collision with another space in this organisation")
  }

  // --- validate the plan before it touches the database -----------------------
  const seen = new Set()
  for (const page of pages) {
    const key = page.title.toLowerCase()
    if (seen.has(key)) throw new Error(`Duplicate page title: "${page.title}"`)
    seen.add(key)
    if (page.parent && !pages.some((p) => p.title.toLowerCase() === page.parent.toLowerCase())) {
      throw new Error(`"${page.title}" names a missing parent "${page.parent}"`)
    }
  }

  // --- resolve or create the space ---------------------------------------------
  const [existingSpace] = await sql`
    select id from nexus_spaces
    where tenant_id = ${tenantId} and lower(name) = lower(${space.name}) and deleted_at is null
    limit 1`

  let spaceId = existingSpace?.id ?? null
  const placeholderId = "00000000-0000-0000-0000-000000000000"
  if (dry && !spaceId) spaceId = placeholderId

  const authorId = spaceId === placeholderId ? null : await authorFor(sql, tenantId)

  if (!spaceId) {
    const [created] = await sql`
      insert into nexus_spaces (tenant_id, name, icon, description, created_by_id)
      values (${tenantId}, ${space.name}, ${space.icon}, ${space.description}, ${authorId})
      returning id`
    spaceId = created.id
  } else if (!dry) {
    await sql`update nexus_spaces set icon = ${space.icon}, description = ${space.description} where id = ${spaceId}`
  }

  // Read even in a dry run: a report that cannot say what it would retire is not
  // much of a report.
  const existingPages = await sql`
    select id, title, content, parent_id, position, icon
    from nexus_pages
    where space_id = ${spaceId} and deleted_at is null`
  const byTitle = new Map(existingPages.map((p) => [String(p.title).toLowerCase(), p]))

  // Position is the order among siblings, so counting per parent keeps the
  // sidebar in the order the content lists things.
  const siblingCount = new Map()
  const plan = pages.map((page) => {
    const parentKey = page.parent ? page.parent.toLowerCase() : null
    const position = siblingCount.get(parentKey) ?? 0
    siblingCount.set(parentKey, position + 1)
    const prior = byTitle.get(page.title.toLowerCase()) ?? null
    return { ...page, parentKey, position, prior, id: prior?.id ?? null }
  })

  let created = 0
  let updated = 0
  let stale = []

  if (dry) {
    // Report the same create/update split a real run would perform.
    for (const item of plan) {
      const drifted =
        !item.prior ||
        item.prior.content !== item.content ||
        (item.prior.icon ?? null) !== (item.icon ?? null) ||
        item.prior.position !== item.position
      if (drifted) updated++
      else created++
    }
    const kept = new Set(plan.map((p) => p.prior?.id).filter(Boolean))
    stale = existingPages.filter((p) => !kept.has(p.id))
  } else {
    // --- create what is missing -------------------------------------------------
    const toCreate = plan.filter((p) => !p.id)
    await chunked(toCreate, CHUNK, async (batch) => {
      const values = []
      const params = []
      batch.forEach((p, n) => {
        // Stride 9: one parameter per column, with parent_id bound to null.
        // A new page cannot know its parent's id yet — the parent is another page
        // in this same import — so parents are assigned in the reconcile pass
        // below, once every page has an id.
        const b = n * 9
        values.push(
          `($${b + 1}::uuid, $${b + 2}::uuid, $${b + 3}::uuid, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}::int, $${b + 8}, $${b + 9})`,
        )
        params.push(tenantId, spaceId, null, p.title, p.icon ?? null, p.content, p.position, authorId, authorId)
      })
      if (!values.length) return
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

    // --- reconcile structure and text -------------------------------------------
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

    // --- version history ---------------------------------------------------------
    // Every page this import touched keeps the text it now holds, so History is
    // never empty and a restore has somewhere to go.
    //
    // `toUpdate` already contains the pages just created — a page with no prior
    // row is "drifted" by definition — so including `toCreate` again would write
    // two identical history entries for every new page.
    await chunked(toUpdate, CHUNK, async (batch) => {
      const values = []
      const params = []
      batch.forEach((p, n) => {
        const b = n * 4
        values.push(`($${b + 1}::uuid, $${b + 2}, $${b + 3}, $${b + 4})`)
        params.push(p.id, p.title, p.content, authorId)
      })
      await retry(
        () => sql.query(`insert into nexus_page_versions (page_id, title, content, author_id) values ${values.join(", ")}`, params),
        { label: "snapshot versions" },
      )
    })

    // --- soft-delete what this import no longer owns -----------------------------
    const kept = new Set(plan.map((p) => p.id))
    stale = existingPages.filter((p) => !kept.has(p.id))
    if (stale.length) {
      const ids = uuidArray(stale.map((p) => p.id))
      await sql.query(`update nexus_pages set deleted_at = now() where id = any($1::uuid[])`, [ids])
      await sql.query(`delete from nexus_links where from_page_id = any($1::uuid[]) or to_page_id = any($1::uuid[])`, [ids])
    }
  }

  // --- links resolve across the whole tenant, so the graph is built last ------
  const plannedTitles = new Set(plan.map((p) => p.title.toLowerCase()))
  const dangling = new Map()
  let referenceCount = 0
  for (const item of plan) {
    for (const title of linkedTitles(item.content)) {
      referenceCount++
      if (!plannedTitles.has(title)) dangling.set(title, (dangling.get(title) ?? 0) + 1)
    }
  }

  const isNew = plan.filter((p) => !p.prior).length
  console.log(`Pages        : ${plan.length} (${isNew} new, ${plan.length - isNew} present)`)
  console.log(`Links        : ${referenceCount} [[references]]`)
  if (dangling.size) {
    // A link to a page that exists elsewhere in the tenant is fine and intended;
    // only a link to nothing at all is worth reporting.
    const rows = await sql.query(
      `select lower(p.title) as title, s.name as space
         from nexus_pages p join nexus_spaces s on s.id = p.space_id
        where p.tenant_id = $1 and p.deleted_at is null
          and lower(p.title) = any($2::text[])`,
      [tenantId, [...dangling.keys()]],
    )
    const elsewhere = new Map(rows.map((row) => [row.title, row.space]))
    for (const [title, spaceName] of elsewhere) {
      console.log(`              [[${title}]] resolves into ${spaceName}`)
    }
    for (const [title, n] of [...dangling].filter(([t]) => !elsewhere.has(t))) {
      console.log(`              [[${title}]] (x${n}) resolves to nothing — rendered as a "create this page" link`)
    }
  } else {
    console.log("              every [[link]] resolves inside this space")
  }

  if (dry) {
    console.log(
      `\n[dry run] nothing was written. ${space.name}: ${plan.length} page(s) planned (${isNew} new), ${stale.length} would be retired.`,
    )
    return
  }

  // --- rebuild the graph from the final text -----------------------------------
  const idByTitleLower = new Map(plan.map((p) => [p.title.toLowerCase(), p.id]))
  const rows = []
  for (const item of plan) {
    for (const title of linkedTitles(item.content)) {
      const to = idByTitleLower.get(title)
      if (to && to !== item.id) rows.push({ from: item.id, to })
    }
  }

  const managed = uuidArray(plan.map((p) => p.id))
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
      () => sql.query(`insert into nexus_links (from_page_id, to_page_id) values ${values.join(", ")} on conflict do nothing`, params),
      { label: "insert links" },
    )
  })

  console.log(`\n${created} created, ${updated} written, ${stale.length} retired, ${rows.length} links.`)
  console.log(`  https://nexus.axxes.club/dashboard/s/${spaceId}`)
}

// --- CLI ------------------------------------------------------------------------
// node scripts/import-space.mjs <content-module.mjs> [--dry-run]
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const moduleName = process.argv[2]
  if (!moduleName) {
    console.error("usage: node scripts/import-space.mjs <content-module.mjs> [--dry-run]")
    process.exit(1)
  }
  const mod = await import(pathToFileURL(join(HERE, moduleName)).href)
  // A module has no default export, so `default` only appears when one is added
  // later; unwrap it so both shapes work.
  await importSpace(mod.default ?? mod, { dry: process.argv.includes("--dry-run") })
}
