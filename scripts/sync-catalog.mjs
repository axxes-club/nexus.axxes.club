#!/usr/bin/env node
// Rebuild [[The AXXES catalog]] in the Company space from the live catalog table.
//
//   node scripts/sync-catalog.mjs --dry-run   # report only, write nothing
//   node scripts/sync-catalog.mjs             # write
//
// The page claimed to be generated from the catalog and the product catalog is
// the single source of truth — but it was a hand-maintained markdown table, and
// it had drifted: it listed 15 products while `axxes_product` held 18. Matter,
// Relay and AXXES Office existed, were live, and were missing from the page that
// is supposed to describe them.
//
// This reads the table rather than restating it, so the page cannot disagree with
// the catalog again. It is deliberately narrow: it replaces one page's content and
// touches nothing else in the space.
//
// Env: DATABASE_URL (falls back to .env.local).

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { neon } from "@neondatabase/serverless"

const HERE = dirname(fileURLToPath(import.meta.url))
const DRY = process.argv.includes("--dry-run")

const TENANT_SLUG = "axxes-club-CgWei8"
const SPACE = "Company"
const PAGE = "The AXXES catalog"

/** Display order, matching the category blurbs in handshake's products.ts. */
const CATEGORY_ORDER = ["Suite", "Events", "Commerce", "Developers", "Work"]

const CATEGORY_BLURB = {
  Suite: "One workspace, one set of numbers.",
  Events: "The night itself: what was sold, who came, and what they did.",
  Commerce: "The money and the stock, reconciled against each other.",
  Developers: "Build on AXXES.",
  Work: "Plan, organize and run the business.",
}

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

const sql = neon(databaseUrl())

const [tenant] = await sql`select id, name, slug from tenants where slug = ${TENANT_SLUG} and deleted_at is null limit 1`
if (!tenant) throw new Error(`Organisation "${TENANT_SLUG}" not found`)

const [space] = await sql`
  select id, name from nexus_spaces
  where tenant_id = ${tenant.id} and lower(name) = lower(${SPACE}) and deleted_at is null limit 1`
if (!space) throw new Error(`Space "${SPACE}" not found in ${tenant.name}`)

// `axxes_product` is owned by members.axxes.club and has no deleted_at — it is
// the one table in the suite without the soft-delete convention, so there is
// nothing to filter on here.
const products = await sql`
  select key, name, category, status, url, sso, surface_in_members, sort_order
  from axxes_product
  order by sort_order, key`

if (!products.length) throw new Error("axxes_product returned no rows; refusing to empty the page")

const counts = products.reduce((acc, p) => {
  acc[p.status] = (acc[p.status] ?? 0) + 1
  return acc
}, {})
const tally = ["live", "beta", "soon", "announced"]
  .filter((s) => counts[s])
  .map((s) => `${counts[s]} ${s}`)
  .join(", ")

const byCategory = CATEGORY_ORDER.map((category) => ({
  category,
  rows: products.filter((p) => p.category === category),
})).filter((g) => g.rows.length)

const unknownCategories = [...new Set(products.map((p) => p.category))].filter(
  (c) => !CATEGORY_ORDER.includes(c),
)

const lines = [
  `Every product AXXES offers, in one table.`,
  ``,
  `This page is generated from the catalog, which is the single source of truth — the`,
  `app launcher, the public product page and this page all read the same rows, so they`,
  `cannot disagree with each other. It is rebuilt by \`node scripts/sync-catalog.mjs\`;`,
  `edit \`axxes_product\`, not this page.`,
  ``,
  `**${products.length} products: ${tally}.**`,
]

for (const { category, rows } of byCategory) {
  lines.push(``, `### ${category}`, ``, CATEGORY_BLURB[category] ?? "", ``,
    `| Product | Key | Status | In the launcher | Where |`,
    `| --- | --- | --- | --- | --- |`)
  for (const p of rows) {
    const status = p.status === "soon" ? "Announced" : p.status.charAt(0).toUpperCase() + p.status.slice(1)
    const listed = p.surface_in_members ? "listed" : "not listed"
    lines.push(`| **${p.name}** | \`${p.key}\` | ${status} | ${listed} | ${p.url} |`)
  }
}

const hidden = products.filter((p) => !p.surface_in_members)
lines.push(
  ``,
  `---`,
  ``,
  `## About the keys`,
  ``,
  `The \`key\` column is permanent. It is referenced by the plan catalog, the OIDC`,
  `client registry, the integrations providers and the suite registry, so a key is`,
  `never renamed — a product's *name* changes regularly and that is fine, but the key`,
  `is a stable internal identifier.`,
  ``,
  `That is why **Stock** above is the product whose key is \`manifest\`, why **Rooms** is`,
  `the product whose key is \`qortr\`, and why **AXXES Developers** and **AXXES for`,
  `Builders** are two separate rows: they are two different products that both happen`,
  `to be developer tools.`,
  ``,
  `## About the ones not listed`,
  ``,
  `"Not listed" means the product is deliberately kept out of the members launcher. It is`,
  `registered, supported and reachable — just not part of the default view.`,
  ``,
  `The horizontal **Work** tools are held back on purpose: each one invites a comparison`,
  `against a company with a hundred times the headcount, and on brand alone that`,
  `comparison is lost. See [[Work — internal tools]].`,
  ``,
  `**Keel** is registered ahead of launch so the key is reserved rather than invented at`,
  `launch, which would risk colliding with whatever got claimed first.`,
)

if (unknownCategories.length) {
  lines.push(``, `## A category is not on this page`, ``,
    `The catalog holds rows in ${unknownCategories.map((c) => `\`${c}\``).join(", ")}, which is not in`,
    `\`CATEGORY_ORDER\` in \`sync-catalog.mjs\`. They are in the table and in the launcher;`,
    `they are simply not filed under a heading here. That is a bug in the page, not in the`,
    `catalog.`)
}

const content = lines.join("\n")

const [page] = await sql`
  select id, title, content from nexus_pages
  where space_id = ${space.id} and lower(title) = lower(${PAGE}) and deleted_at is null limit 1`
if (!page) throw new Error(`Page "${PAGE}" not found in ${SPACE}`)

const changed = page.content !== content
console.log(`Organisation : ${tenant.name} (${tenant.slug})`)
console.log(`Page         : ${SPACE} / ${PAGE}`)
console.log(`Products     : ${products.length} (${tally})`)
if (unknownCategories.length) console.log(`Unfiled      : ${unknownCategories.join(", ")}`)

if (!changed) {
  console.log("\nNo change. The page already matches the catalog.")
  process.exit(0)
}

if (DRY) {
  console.log(`\n[dry run] nothing was written. ${page.content.length} -> ${content.length} characters.`)
  console.log("\n--- new content ---\n")
  console.log(content)
  process.exit(0)
}

const [author] = await sql`select owner_id from tenants where id = ${tenant.id}`
await sql`update nexus_pages set content = ${content}, updated_by_id = ${author.owner_id}, updated_at = now() where id = ${page.id}`
// Snapshot, so History holds the page as it was before this rewrite.
await sql`insert into nexus_page_versions (page_id, title, content, author_id) values (${page.id}, ${page.title}, ${page.content}, ${author.owner_id})`

console.log(`\nUpdated. ${page.content.length} -> ${content.length} characters, one version snapshot.`)
console.log(`  https://nexus.axxes.club/dashboard/s/${space.id}/${page.id}`)
