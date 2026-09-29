#!/usr/bin/env node
// Import the Bayamón Educación Municipal site into the Nexus KB.
//
// Idempotent: safe to re-run. It matches an existing space by name, updates
// pages in place by title, and soft-deletes pages that are no longer in the
// content file. Wiki links ([[Page title]]) are rebuilt from the final text,
// exactly as savePage() does in the app, so backlinks and ⌘K stay correct.
//
//   node scripts/import-bayamon-educacion.mjs --dry-run   # report only
//   node scripts/import-bayamon-educacion.mjs             # write
//
// Env: DATABASE_URL (falls back to .env.local). Nothing else is needed — the
// nexus_* tables are created by scripts/create-tables.sql, which has run.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { neon } from "@neondatabase/serverless"
import { SPACE, PAGES } from "./bayamon-educacion-content.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const DRY = process.argv.includes("--dry-run")

/** The organization this content belongs to. */
const TENANT_SLUG = "educacion-municipal-bayamon"

/** Page nesting. Anything not listed sits at the top level of the space. */
const PARENT = {
  "programa-direccion": "programas",
  "programa-servicios-al-estudiante": "programas",
  "programa-mantenimiento": "programas",
  "head-start-mision": "head-start",
  "head-start-requisitos": "head-start",
  "head-start-programas": "head-start",
  "head-start-centros": "head-start",
  "inventario-fuentes": "inventario",
  "inventario-fotos": "inventario",
}

const depth = (key) => (PARENT[key] ? 1 + depth(PARENT[key]) : 0)

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

// Same expression the app uses in savePage(): [[title]] outside code spans.
const WIKI_LINK = /\[\[([^\]|]{1,200})(?:\|([^\]]{1,200}))?\]\]/g
function linkedTitles(content) {
  const titles = new Set()
  const outsideCode = content.replace(/```[\s\S]*?```|`[^`\n]*`/g, "")
  for (const m of outsideCode.matchAll(WIKI_LINK)) titles.add(m[1].trim().toLowerCase())
  return [...titles]
}

/** Pages are attributed to the org's owner, so History reads as the department's. */
async function authorFor(sql, tenantId) {
  const [owner] = await sql`select owner_id from tenants where id = ${tenantId}`
  if (owner) return owner.owner_id
  const [admin] = await sql`select user_id from tenant_memberships where tenant_id = ${tenantId} order by is_primary desc limit 1`
  if (!admin) throw new Error(`No owner or member found for organization ${TENANT_SLUG}`)
  return admin.user_id
}

const sql = neon(databaseUrl())

/**
 * A safe literal list of UUIDs for an IN (...) clause. These ids come from
 * rows this script just read back out of the database, and each is checked
 * against the UUID shape, so interpolating them cannot inject SQL.
 */
function uuidList(ids) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const clean = [...new Set(ids)]
  for (const id of clean) {
    if (typeof id !== "string" || !uuid.test(id)) throw new Error(`Refusing to interpolate non-UUID id: ${id}`)
  }
  if (!clean.length) throw new Error("Refusing to build an empty IN () list")
  return clean.map((id) => `'${id}'`).join(", ")
}

// --- Locate the organization -------------------------------------------------
const [tenant] = await sql`select id, name, slug from tenants where slug = ${TENANT_SLUG} and deleted_at is null`
if (!tenant) throw new Error(`Organization "${TENANT_SLUG}" not found. Create it first.`)
console.log(`Organization: ${tenant.name} (${tenant.slug})`)

const authorId = await authorFor(sql, tenant.id)

// --- Create or reuse the space ----------------------------------------------
const [existing] = await sql`select id, name from nexus_spaces where tenant_id = ${tenant.id} and lower(name) = lower(${SPACE.name}) and deleted_at is null limit 1`
let spaceId = existing?.id ?? null

if (spaceId) {
  console.log(`Reusing space "${SPACE.name}" (${spaceId})`)
  if (!DRY) await sql`update nexus_spaces set icon = ${SPACE.icon}, description = ${SPACE.description} where id = ${spaceId}`
} else if (DRY) {
  console.log(`Would create space "${SPACE.name}"`)
} else {
  console.log(`Creating space "${SPACE.name}"`)
  const [row] = await sql`insert into nexus_spaces (tenant_id, name, icon, description, created_by_id) values (${tenant.id}, ${SPACE.name}, ${SPACE.icon}, ${SPACE.description}, ${authorId}) returning id`
  spaceId = row.id
}

// --- Reconcile the pages -----------------------------------------------------
// Parents are written before their children, so a child's parent_id resolves.
const ordered = [...PAGES].sort((a, b) => depth(a.key) - depth(b.key))

// The existing pages are read even on a dry run. A dry run has to compare
// against what is really there, otherwise it reports every page as new and
// hides both the updates and the pages it would retire — which is the whole
// point of asking for a dry run first.
const existingPages = spaceId
  ? await sql`select id, title, content, parent_id from nexus_pages where space_id = ${spaceId} and deleted_at is null`
  : []

const byTitle = new Map(existingPages.map((p) => [p.title.toLowerCase(), p]))
const idByKey = new Map()
const keptIds = new Set()
let created = 0
let updated = 0

for (const [position, page] of ordered.entries()) {
  const parentKey = PARENT[page.key]
  const parentId = parentKey ? idByKey.get(parentKey) ?? null : null
  if (parentKey && !parentId) {
    throw new Error(`Parent "${parentKey}" missing for "${page.key}" — parents must be imported first`)
  }

  const prior = byTitle.get(page.title.toLowerCase())

  if (DRY) {
    if (prior) {
      // Mark it kept, or the reconciliation below would report every page in
      // the space as stale and a dry run would look like a mass deletion.
      keptIds.add(prior.id)
      updated++
    } else {
      created++
    }
    idByKey.set(page.key, prior?.id ?? `dry-run:${page.key}`)
    continue
  }

  if (prior) {
    // Snapshot only when the text really changed, so re-running is a no-op.
    if (prior.content !== page.content) {
      await sql`insert into nexus_page_versions (page_id, title, content, author_id) values (${prior.id}, ${prior.title}, ${prior.content}, ${authorId})`
    }
    await sql`update nexus_pages set title = ${page.title}, icon = ${page.icon}, content = ${page.content}, parent_id = ${parentId}, position = ${position}, updated_by_id = ${authorId}, updated_at = now() where id = ${prior.id}`
    idByKey.set(page.key, prior.id)
    keptIds.add(prior.id)
    if (prior.content !== page.content || prior.parent_id !== parentId) updated++
  } else {
    const [row] = await sql`insert into nexus_pages (tenant_id, space_id, parent_id, title, icon, content, position, created_by_id, updated_by_id) values (${tenant.id}, ${spaceId}, ${parentId}, ${page.title}, ${page.icon}, ${page.content}, ${position}, ${authorId}, ${authorId}) returning id`
    // The import itself is the first version, so History is never empty.
    await sql`insert into nexus_page_versions (page_id, title, content, author_id) values (${row.id}, ${page.title}, ${page.content}, ${authorId})`
    idByKey.set(page.key, row.id)
    keptIds.add(row.id)
    created++
  }
}

// Soft-delete pages this import no longer owns, and drop links touching them
const removed = existingPages.filter((p) => !keptIds.has(p.id))
if (removed.length) {
  console.log(`Soft-deleting ${removed.length} stale page(s): ${removed.map((p) => p.title).join(", ")}`)
  if (!DRY) {
    const ids = uuidList(removed.map((p) => p.id))
    await sql`update nexus_pages set deleted_at = now() where id in (${sql.unsafe(ids)})`
    await sql`delete from nexus_links where from_page_id in (${sql.unsafe(ids)}) or to_page_id in (${sql.unsafe(ids)})`
  }
}

// --- Rebuild the link graph --------------------------------------------------
if (!DRY) {
  const all = PAGES.map((p) => ({ ...p, id: idByKey.get(p.key) }))
  const idByTitle = new Map(all.map((p) => [p.title.toLowerCase(), p.id]))
  const rows = []
  for (const page of all) {
    for (const title of linkedTitles(page.content)) {
      const to = idByTitle.get(title)
      if (to && to !== page.id) rows.push({ from_page_id: page.id, to_page_id: to })
    }
  }
  const managed = uuidList(all.map((p) => p.id))
  await sql`delete from nexus_links where from_page_id in (${sql.unsafe(managed)})`
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const values = chunk
      .map((_, n) => `($${n * 2 + 1}, $${n * 2 + 2})`)
      .join(", ")
    const params = chunk.flatMap((r) => [r.from_page_id, r.to_page_id])
    await sql.query(`insert into nexus_links (from_page_id, to_page_id) values ${values} on conflict do nothing`, params)
  }
  console.log(`Linked ${rows.length} page references`)
}

console.log(`${DRY ? "[dry run] " : ""}${created} created, ${updated} updated, ${removed.length} removed.`)
if (spaceId) console.log(`Space: /dashboard/s/${spaceId}`)
