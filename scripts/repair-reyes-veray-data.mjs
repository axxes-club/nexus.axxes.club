#!/usr/bin/env node
// Repair corrupted rows in the Colección Reyes-Veray catalogue.
//
//   node scripts/repair-reyes-veray-data.mjs --dry-run   # report only
//   node scripts/repair-reyes-veray-data.mjs             # write
//
// Two distinct faults, both introduced upstream when the WordPress catalogue
// was parsed into these tables:
//
//  1. A stray C0 control character inside a name. One record reads
//     "Monumento Jos<EOT>é Gautier Benítez" — the U+0005 sits inside the
//     accented "é". It is in products.name and in the matching assets' name
//     and alt_text, so it reaches the alt text of an <img> as well.
//
//  2. artwork_details.artist_name holds something that is not a name. A bad
//     line-based parse pulled fragments of the description blob into the
//     column: "A. CRV #0821", "“Beto”. CRV #2071", ". CRv #1667",
//     "Planos y Maqueta", and in one case an entire sentence about the
//     Philadelphia Academy of Fine Arts.
//
// For (2) the repair source is artist_sort_name, which is intact. Where it
// reads "Surname, Given" the name is flipped back. Where it does not — because
// the row is an architecture or publication record, not a work by a person, so
// the "sort name" is a project caption like "Casa de Jesús T. Piñero,
// Canóvanas – 2005" — there is no artist to recover and the column is cleared
// rather than filled with something invented.
//
// Env: DATABASE_URL (falls back to .env.local).

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { neon } from "@neondatabase/serverless"

const HERE = dirname(fileURLToPath(import.meta.url))
const DRY = process.argv.includes("--dry-run")
const TENANT_SLUG = "coleccion-reyes-veray"

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

/** Strip C0 controls and DEL, leaving tab, newline and carriage return. */
function stripControls(text) {
  // eslint-disable-next-line no-control-regex
  return String(text ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
}

const fold = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const words = (s) => new Set(fold(s).split(" ").filter(Boolean))
const sharesWord = (a, b) => {
  const A = words(a)
  const B = words(b)
  for (const w of A) if (B.has(w)) return true
  return false
}

/**
 * "Maisonet Ramos, Luis" -> "Luis Maisonet Ramos".
 * Only called on a sort name already known to be a person's name.
 */
function flipSortName(sortName) {
  const comma = sortName.indexOf(",")
  if (comma < 0) return null
  const surname = sortName.slice(0, comma).trim()
  const given = sortName.slice(comma + 1).trim()
  if (!surname || !given) return null
  return `${given} ${surname}`
}

/**
 * Does this sort name actually name a person?
 *
 * The give must be one to four capitalised words, and the whole string must
 * carry no digits and no dash — "Loiza – 2000" and "Canóvanas – 2005" are
 * places in a project caption, not people.
 */
const PERSON_SORT = /^([^,]+),\s*([\p{Lu}][\p{L}'’.\- ]{0,28})$/u
function personNameFromSort(sortName) {
  const value = String(sortName ?? "").trim()
  if (!value) return null
  if (/[0-9–—]/.test(value)) return null
  const m = value.match(PERSON_SORT)
  if (!m) return null
  const given = m[2].trim().split(/\s+/).filter(Boolean)
  if (!given.length || given.length > 4) return null
  return flipSortName(value)
}

/**
 * A second chance, taken from the corrupt column itself.
 *
 * Some rows have it backwards: artist_name holds the person
 * ("(Irizarry, Edgar). CRV #0427") while artist_sort_name is the unusable
 * "El depe Te". Dropping the CRV fragment and the brackets leaves
 * "Irizarry, Edgar", which flips to "Edgar Irizarry".
 */
function personNameFromCorrupt(value) {
  let text = String(value ?? "")
    .replace(/\s*\.?\s*crv\s*#.*$/i, "")
    .replace(/[.·]\s*$/, "")
    .trim()
  // Unwrap a single pair of brackets: "(Irizarry, Edgar)".
  const wrapped = text.match(/^\(([^()]+)\)$/)
  if (wrapped) text = wrapped[1].trim()
  if (!text.includes(",")) return null
  return personNameFromSort(text)
}

async function main() {
  const [tenant] = await sql`select id, name from tenants where slug = ${TENANT_SLUG} limit 1`
  if (!tenant) throw new Error(`No tenant with slug "${TENANT_SLUG}"`)
  console.log(`Organisation : ${tenant.name}`)
  console.log(DRY ? "[dry run]   : nothing will be written\n" : "")

  // --- 1. control characters ---------------------------------------------
  const controlColumns = [
    ["products", "name"],
    ["products", "description"],
    ["products", "slug"],
    ["artists", "name"],
    ["artists", "bio"],
    ["artists", "lifespan"],
    ["artwork_details", "artist_name"],
    ["artwork_details", "artist_sort_name"],
    ["artwork_details", "title"],
    ["artwork_details", "notes"],
    ["assets", "name"],
    ["assets", "alt_text"],
    ["assets", "url"],
  ]

  let controlFixes = 0
  console.log("Control characters")
  for (const [table, column] of controlColumns) {
    const rows = await sql.query(
      `select id, ${column} as value from ${table}
        where tenant_id = $1 and ${column} is not null
          and regexp_replace(${column}, '[\\n\\r\\t]', '', 'g') ~ '[[:cntrl:]]'`,
      [tenant.id],
    )
    for (const row of rows) {
      const cleaned = stripControls(row.value)
      if (cleaned === row.value) continue
      controlFixes++
      if (controlFixes <= 6) {
        console.log(`  ${table}.${column}  ${JSON.stringify(row.value).slice(0, 70)}`)
        console.log(`    -> ${JSON.stringify(cleaned).slice(0, 70)}`)
      }
      if (!DRY) {
        await sql.query(`update ${table} set ${column} = $2, updated_at = now() where id = $1`, [row.id, cleaned])
      }
    }
  }
  console.log(`  ${controlFixes} value(s) cleaned\n`)

  // --- 2. artist_name holding something that is not a name ---------------
  const rows = await sql`
    select id, artist_name, artist_sort_name
    from artwork_details
    where tenant_id = ${tenant.id}
      and artist_name is not null and btrim(artist_name) <> ''
    order by id`

  const repairs = []
  for (const row of rows) {
    const name = String(row.artist_name)
    const sort = row.artist_sort_name

    // Only objective defects count. "Shares no word with the sort name" is not
    // one of them on its own: the sort name is itself sometimes junk
    // ("El depe Te"), and judging a good name bad because a bad neighbour
    // disagrees would delete exactly the names this script just recovered.
    const holdsCrv = /crv\s*#/i.test(name)
    const tooLong = name.length > 60
    const leadingDot = /^\s*\./.test(name)
    const disjoint = sort ? !sharesWord(name, sort) : false

    if (!(holdsCrv || tooLong || leadingDot)) continue

    const recovered = personNameFromSort(sort) ?? personNameFromCorrupt(name)
    repairs.push({
      id: row.id,
      from: name,
      to: recovered,
      reason: [holdsCrv && "carries a CRV number", tooLong && "is a sentence", leadingDot && "starts mid-sentence"]
        .filter(Boolean)
        .join(" + "),
      disjoint,
    })
  }

  const recovered = repairs.filter((r) => r.to)
  const cleared = repairs.filter((r) => !r.to)
  console.log("artist_name")
  console.log(`  ${repairs.length} row(s) corrupted`)
  console.log(`  ${recovered.length} recoverable from artist_sort_name`)
  console.log(`  ${cleared.length} are not works by a person; the column will be cleared`)
  for (const r of recovered.slice(0, 10)) {
    console.log(`  ${JSON.stringify(r.from).slice(0, 46).padEnd(48)} -> ${r.to}`)
  }
  for (const r of cleared.slice(0, 6)) {
    console.log(`  ${JSON.stringify(r.from).slice(0, 46).padEnd(48)} -> (cleared)  [${r.reason}]`)
  }

  if (!DRY) {
    for (const r of repairs) {
      await sql`update artwork_details set artist_name = ${r.to}, updated_at = now() where id = ${r.id}`
    }
  }

  console.log(
    `\n${DRY ? "[dry run] " : ""}${controlFixes} control character(s) cleaned, ` +
      `${recovered.length} artist name(s) recovered, ${cleared.length} cleared.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
