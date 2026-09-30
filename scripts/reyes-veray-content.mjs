// The Colección Reyes-Veray knowledge base, generated from the AXXES database.
//
// Everything here is read from Postgres — the same database the site, the DAM
// and Nexus all share. Nothing is scraped and nothing is invented: the artists,
// their biographies, the catalogue entries, the CMS copy and the images all
// come from tables that are already the source of truth.
//
//   artists           591  biographies, lifespans
//   artwork_details   3667 medium, dimensions, year, edition, series, CRV number
//   products          3667 the public catalogue entry, description, slug
//   assets           11219 the DAM's image records (folders.axxes.club)
//   pages + blocks      4  the editorial pages: about, exhibition, contact
//
// THREE SPACES, because the archive holds two unrelated bodies of work plus
// the research around them:
//
//   The Collector and Art Business   the art collection: artists and their works
//   The Architecture Practice        Reyes Casanova's buildings and projects
//   Research & Publications          monographs, bulletins and plans
//
// Nothing in the schema separates those three. There are no categories (the
// table is empty), no tags, and no type column, so `classify()` below has to
// read the shape of the record instead:
//
//   * A CRV number is definitive. It is authoritative in artwork_details and
//     also appears in the product name ("Somoza, Maria Emilia. 1376") on ~700
//     rows where the column was never filled in. Both mean artwork.
//   * A publication says so: "Editor:", "Autora:", a magazine or bulletin
//     in the name.
//   * An architecture record has no CRV number and reads like a building:
//     "Construido", "Restauración", a "Name, Location – Year" caption, a
//     project noun, or simply a large photo set.
//   * An artist entry has no CRV number either, but its name is a person —
//     often misspelled or nicknamed against the artists table ("Lyzette
//     Rosado" for "Lizette Rosado", "Jorge “Rito” Cordero Ramos" for
//     "Jorge “Rito” Cordero"), so the match is fuzzy and folds the row's
//     images into that artist's page rather than inventing a work.
//
// Whatever is left over is kept as unattributed art rather than dropped, and
// anything classified on weak evidence is reported so it can be reviewed.
//
// Page titles are unique per space. Nexus resolves [[wiki links]] by title
// across the whole tenant, so a repeated title would merge two works into one;
// collisions get a numeric suffix.

const TENANT_SLUG = "coleccion-reyes-veray"
export { TENANT_SLUG }

/** Where the public catalogue lives, linked from every artwork page. */
const SITE_ROOT = "https://coleccionreyesveray.com"

/** The DAM. Deep links are by asset id, which is what the DAM's own UI uses. */
/**
 * The DAM. Folders has no per-asset route: it is a single-page app whose only
 * routes are "/", "/sign-in", "/share/[token]" and "/m/[token]". A link of the
 * form folders.axxes.club/assets/<id> was returning 404, so the catalogue
 * points at the app itself and names the file in the link text. The one
 * addressable view of a single file is a signed share token, which expires —
 * not something to bake into four thousand pages.
 */
const FOLDERS_ROOT = "https://folders.axxes.club"

export const SPACES = [
  {
    name: "The Collector and Art Business",
    icon: "🏛️",
    description:
      "The private archive of architect Otto Octavio Reyes Casanova and Vionnette Veray: the artists they collected and every work catalogued.",
  },
  {
    name: "The Architecture Practice",
    icon: "🏗️",
    description:
      "Otto Octavio Reyes Casanova's own buildings, restorations and unrealised projects, documented from the archive.",
  },
  {
    name: "Research & Publications",
    icon: "📚",
    description:
      "Monographs, bulletins, plans and reports held in the archive alongside the collection.",
  },
]

// --- normalisation ----------------------------------------------------------

/** Lowercase, strip accents and punctuation, drop anything in parentheses. */
function fold(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function tokens(value) {
  return fold(value).split(" ").filter(Boolean)
}

/**
 * Every word, including the ones inside brackets.
 *
 * `fold` drops "(Mal)" from "Manuel Álvarez Lezama (Mal)" so that the two
 * spellings of a name compare equal. That is right for an exact match and
 * wrong for recognition: "Abismael (Aby) Ruiz" has to keep its "Aby" for the
 * containment pass to see that the artists table's "Aby Ruiz" is the same
 * person. This is that other view.
 */
function tokensAll(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
}

/**
 * Order-insensitive key. "Ángel Capllonch", "Capllonch, Ángel" and
 * "capllonch angel" all fold to the same string, which is what lets a
 * surname-first artist row meet a givenname-first artwork row.
 */
function nameKey(value) {
  return tokens(value).sort().join(" ")
}

/** Levenshtein distance, capped: these names are short and we only need "close". */
function editDistance(a, b) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 99
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = row
  }
  return prev[b.length]
}

/**
 * How alike two names are, allowing one typo or dropped token per word.
 *
 * Exact token sets are the normal case. This exists for the rows whose name
 * disagrees with the artists table on a nickname or a spelling: "Lyzette
 * Rosado" against "Lizette Rosado", "Radamés “Juni” Figueroa" against
 * "Radames Figueroa", "Ángel Giovanni Ruiz" against "Giovanni Ruíz". A
 * surname still has to line up, so "Ruiz" never matches "Rosa".
 */
function nameSimilarity(a, b) {
  const ta = tokens(a)
  const tb = tokens(b)
  if (!ta.length || !tb.length) return 0
  if (nameKey(a) === nameKey(b)) return 1

  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  // Every token of the shorter name must be accounted for in the longer one.
  let matched = 0
  const pool = [...long]
  for (const t of short) {
    const i = pool.findIndex((u) => u === t || editDistance(u, t) <= 1)
    if (i >= 0) {
      matched++
      pool.splice(i, 1)
    }
  }
  if (matched < short.length) return 0
  return matched / long.length
}

/** The stable identity of an image, independent of host and query string. */
function imagePath(url) {
  const match = String(url ?? "").match(/\/wp-content\/uploads\/[^?#\s]+/i)
  return match ? match[0].toLowerCase() : null
}

// --- markdown helpers -------------------------------------------------------

/**
 * Escape the characters that would otherwise be read as markdown structure.
 * Bios are prose written for a web page and contain bare underscores, asterisks
 * and angle brackets often enough to matter.
 */
function escapeInline(text) {
  return String(text ?? "").replace(/([\\`*_[\]<>])/g, "\\$1").replace(/\r/g, "")
}

/**
 * A cell in a definition table. Pipes and newlines have to go, or the row
 * breaks and the table swallows the rest of the page.
 */
function cell(value) {
  return String(value ?? "")
    .replace(/\r?\n+/g, " ")
    .replace(/\|/g, "\\|")
    .trim()
}

/**
 * Paragraphs from a stored block of plain text. Blank-line separated, so a bio
 * that was one blob still reads as prose.
 */
function paragraphs(text) {
  return String(text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
}

const provenance = () => `\n---\n\n_Source: [${TENANT_SLUG}](${SITE_ROOT}) · [Folders](${FOLDERS_ROOT})_`

// --- names ------------------------------------------------------------------

/** The catalogue name without the site suffix, which is on every row. */
export function readableName(product) {
  return String(product?.name ?? "")
    // Some names carry a stray control character mid-word: the source has
    // "Monumento Jos\u0005eacute Gautier Ben\u00edtez", with a C0 control
    // sitting inside the accented letter. Dropping C0 and DEL costs nothing
    // and repairs the word.
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s*[–—-]\s*Colecci[oó]n Reyes[- ]?Veray\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * The CRV number, from the column when it was filled in and from the product
 * name when it was not. Roughly 700 artworks carry the number only in the
 * name, and treating those as "no number" would misfile them.
 */
export function crvNumber(product, detail) {
  if (detail?.inventory_number) return detail.inventory_number
  const match = readableName(product).match(/[.,]\s*(\d{3,4}[a-z]?)\s*$/i)
  return match ? match[1] : null
}

/** A year, from the artwork column or from a trailing "– 1999" in the name. */
export function yearOf(product, detail) {
  if (detail?.year && /\d{4}/.test(detail.year)) return (detail.year.match(/\d{4}/) ?? [])[0]
  const fromName = readableName(product).match(/\s[–—-]\s*(\d{4})\s*$/)
  if (fromName) return fromName[1]
  const fromDesc = String(product?.description ?? "").match(/\b(1[89]\d{2}|20\d{2})\b/)
  return fromDesc ? fromDesc[1] : null
}

// --- classification ---------------------------------------------------------

const PUBLICATION_WORD =
  /Bolet[ií]n|Revista|Plan Maestro|Informe de Restauraci|Galer[ií]a Nacional|Cat[aá]logo|Indice de Architects|Editor:|Autora:|Publicaci|Anuario/i

const ARCHITECTURE_WORD =
  /^(Casa|Residencia|Apartamentos?|Atelier|Torre|Hotel|Botanical|Calesas|Caleta|Beach|Oficina|Centro|Escuela|Edificio|Biblioteca|Museo|Urbanizaci|Park|Plaza|Marina|Muelle|Almac[eé]n|Pabell[ií]n|Monumento|Banco|Industria|Fabrica|Spring|Cancha|Pol[ií]dromo|Club|Expo|Villa|Quinta|Hacienda|Fortaleza|Grupo|Storehouse|Interprofessional|Introducci)/i

/**
 * Does this description read as an artist's biography rather than a caption?
 *
 * The catalogue holds portrait pages for a number of artists who have no row in
 * the artists table at all — "Abdías Méndez Robles", "Carlos Ortiz Burgos".
 * Their record is a life: dates in brackets, then prose. A building's record is
 * a caption: a name, a place, a year, and a status. Telling them apart is what
 * keeps a six-portrait page from being filed as a photograph set.
 */
function looksLikeBiography(description) {
  const text = String(description ?? "").trim()
  if (!text) return false

  // "Abismael (Aby) Ruiz" then "(Arecibo, PR, 1971)" then "Pintor y dibujante…"
  const head = text.split("\n").slice(0, 3).join(" ")
  const hasLifespan = /\([^)]*\b(1[5-9]\d{2}|20\d{2})\b[^)]*\)/.test(head)

  const prose =
    /\b(naci[oó]|naciu|born|estudi[oó]|studied|exhib|profesor|professor|pintor|pintora|dibujante|draftsman|escultor|sculptor|grabador|artista gr[aá]fic|se gradu[oó]|graduated)\b/i.test(
      text,
    )

  // Long and sentence-shaped, rather than a list of captions.
  const sentencey = text.length > 180 && /[.!?]/.test(text)

  return hasLifespan || (prose && sentencey)
}

/**
 * Which of the three spaces a catalogue row belongs to, and what it is.
 *
 *   "artwork"          a catalogued work of art
 *   "artistEntry"      a row that is really an artist, folded into their page
 *   "architecture"     a building, restoration or unrealised project
 *   "publication"      a monograph, bulletin, plan or report
 */
export function classify(row, artistLookup) {
  const name = readableName(row.product)
  const description = String(row.product.description ?? "")

  // A CRV number settles it. Everything else is inference.
  if (crvNumber(row.product, row.detail)) return "artwork"

  // A book says so in its title or in its own credit line.
  if (PUBLICATION_WORD.test(name) || /Editor:|Autora:|Publicaci[oó]n:/i.test(description)) {
    return "publication"
  }

  if (artistLookup && artistLookup(row)) return "artistEntry"

  // A life, not a building. Checked before the architecture heuristics, which
  // would otherwise claim any artist who happens to have five portraits.
  if (looksLikeBiography(description)) return "artistEntry"

  const looksLikeBuilding =
    /Construido|No Construido|Restauraci[oó]n|Rehabilitaci[oó]n|Remodelaci[oó]n|Demolici[oó]n/i.test(
      description,
    ) ||
    /^[^\n]{3,90},\s*[^,\n]{2,40}\s*[–-]\s*\d{4}/.test(description) ||
    /\s[–-]\s*\d{4}\s*$/.test(name) ||
    ARCHITECTURE_WORD.test(name)

  if (looksLikeBuilding) return "architecture"

  // No CRV, no artist, no caption: a wall of photographs is a building, and a
  // single image is a picture of something.
  if (row.assets.length >= 5) return "architecture"

  return "artwork"
}

/** Decade label used to group the architecture space. */
function decadeOf(year) {
  if (!year) return "Date not recorded"
  const n = Number(year)
  if (!Number.isFinite(n)) return "Date not recorded"
  return `${Math.floor(n / 10) * 10}s`
}

// --- page builders ----------------------------------------------------------

/** The stored description repeats the artist and the CRV number; drop that head. */
function parseDescription(description, { artistName }) {
  const raw = String(description ?? "").trim()
  if (!raw) return { title: null, body: "" }

  const lines = raw.split(/\r?\n/).map((l) => l.trim())
  let cursor = 0
  if (artistName && fold(lines[0]) === fold(artistName)) cursor = 1
  if (cursor < lines.length && /^crv\s*#/i.test(lines[cursor].replace(/^\.\s*/, ""))) cursor += 1

  const remainder = lines.slice(cursor)
  const mediumish =
    /(sobre |serigraf|litograf|pintura|acuarela|oleo|oil|tinta|ink|fotograf|grabado|grabados|collage|mixed media|bronze|bronce|escultura|papel)/i
  const stop = remainder.findIndex(
    (l) => mediumish.test(l) || /^\d{4}(-\d{1,4})?$/.test(l) || /^ed\./i.test(l),
  )

  const titleLines = (stop === -1 ? remainder : remainder.slice(0, stop)).filter(Boolean)
  const body = (stop === -1 ? [] : remainder.slice(stop)).filter(Boolean)
  const title = titleLines.join(" ").replace(/\s+/g, " ").trim() || null

  return { title: title && !/^crv/i.test(title) ? title : null, body: body.join("\n\n") }
}

function specRow(label, value) {
  const v = cell(value)
  return v ? `| **${label}** | ${v} |` : null
}

/** The image block shared by artwork, architecture and publication pages. */
function imageBlock(assets, fallbackAlt) {
  const parts = []
  for (const asset of assets) {
    const label = escapeInline(asset.alt_text || fallbackAlt)
    const size = asset.width && asset.height ? ` - ${asset.width}×${asset.height}` : ""
    parts.push(`![${label}](${asset.url})`)
    parts.push(`_${label}${size} — catalogued in [Folders](${FOLDERS_ROOT})_`, "")
  }
  return parts
}

function artworkPage({ product, detail, artist, assets }) {
  const { title: parsedTitle, body } = parseDescription(product.description, {
    artistName: detail?.artist_name ?? artist?.name,
  })

  const rows = [
    specRow("Artist", artist ? `[[${artist.name}]]` : cell(detail?.artist_name) || null),
    specRow("Title", detail?.title || parsedTitle),
    specRow("CRV no.", crvNumber(product, detail)),
    specRow("Medium", detail?.medium),
    specRow("Dimensions", detail?.dimensions),
    specRow("Year", detail?.year),
    specRow("Edition", detail?.edition),
    specRow("Series", detail?.series),
    specRow("Location", detail?.location),
    specRow("Provenance", detail?.origin),
  ].filter(Boolean)

  const publications = Array.isArray(detail?.publications)
    ? detail.publications.filter((p) => String(p ?? "").trim())
    : []

  const parts = imageBlock(assets, product.name)
  if (rows.length) parts.push("| | |", "| --- | --- |", ...rows, "")
  if (body) parts.push("## Catalogue entry", "", escapeInline(body), "")
  if (publications.length) {
    parts.push("## Publications", "")
    for (const pub of publications) parts.push(`- ${escapeInline(pub)}`)
    parts.push("")
  }
  if (detail?.notes) parts.push("## Notes", "", escapeInline(detail.notes), "")
  if (artist) parts.push(`Part of the works of [[${artist.name}]] in this collection.`, "")

  const links = []
  if (assets[0]) links.push(`[Catalogued in Folders](${FOLDERS_ROOT})`)
  if (product.slug) links.push(`[View on the collection site](${SITE_ROOT}/${product.slug}/)`)
  parts.push(links.join(" · "))

  return `${parts.join("\n").trim()}${provenance()}`
}

/** Architecture and publications share a shape: a caption, a year, photographs. */
function projectPage({ product, detail, assets, kind }) {
  const parts = []
  const rows = [
    specRow("Title", detail?.title),
    specRow("Year", yearOf(product, detail)),
    specRow("Type", kind === "publication" ? "Publication held in the archive" : null),
    specRow("Location", detail?.location),
    specRow("Notes", detail?.notes),
  ].filter(Boolean)

  const description = String(product.description ?? "").trim()
  if (rows.length) parts.push("| | |", "| --- | --- |", ...rows, "")
  if (description) {
    parts.push("## From the archive", "")
    for (const p of paragraphs(description)) parts.push(escapeInline(p), "")
  }

  parts.push(...imageBlock(assets, product.name))
  if (!assets.length) parts.push("_No image is held in the archive for this record._", "")

  const links = []
  if (product.slug) links.push(`[View on the collection site](${SITE_ROOT}/${product.slug}/)`)
  if (links.length) parts.push(links.join(" · "))

  return `${parts.join("\n").trim()}${provenance()}`
}

/**
 * The stored biography opens by restating the artist and their dates, and the
 * artist page already shows both above it. The name and the dates sit on
 * separate lines, so the prefix is dropped line by line.
 */
function stripBioPrefix(bio, artist) {
  const name = String(artist.name ?? "").trim()
  if (!name) return String(bio ?? "").trim()

  const key = fold(name)
  const isPrefixLine = (line) => {
    const trimmed = line.trim()
    if (!trimmed) return false
    if (fold(trimmed) === key) return true
    if (/^\(.*\)$/.test(trimmed)) return true
    return fold(trimmed).startsWith(`${key} `)
  }

  const lines = String(bio ?? "").replace(/\r/g, "").split("\n")
  let start = 0
  while (start < lines.length && isPrefixLine(lines[start])) start++
  return lines.filter((line, i) => i >= start && fold(line) !== key).join("\n").trim()
}

function artistPage({ artist, works, entries }) {
  const parts = []

  if (artist.lifespan) parts.push(`**${escapeInline(artist.lifespan)}**`, "")

  const bio = stripBioPrefix(artist.bio, artist)
  if (bio && fold(bio) !== fold(artist.name)) {
    for (const p of paragraphs(bio)) parts.push(escapeInline(p), "")
  }

  // A catalogue row that turned out to be this artist, rather than a work by
  // them, carries their portraits. They belong on the artist's own page.
  if (entries?.length) {
    parts.push("## Portraits and records in the archive", "")
    for (const entry of entries) parts.push(...imageBlock(entry.assets, entry.product.name))
  }

  parts.push("## Works in the collection", "")
  if (!works.length) {
    parts.push("_No catalogue entry is currently linked to this artist._", "")
  } else {
    for (const work of works) {
      const bits = []
      const crv = crvNumber(work.product, work.detail)
      if (crv) bits.push(`CRV #${crv}`)
      if (work.detail?.year) bits.push(work.detail.year)
      if (work.detail?.medium) bits.push(work.detail.medium)
      parts.push(`- [[${work.title}]]${bits.length ? ` - ${escapeInline(bits.join(" · "))}` : ""}`)
    }
    parts.push("")
  }

  return `${parts.join("\n").trim()}${provenance()}`
}

function artistIndexPage(entries, stubs) {
  const parts = [
    `The collection holds works by **${entries.length} artists**. Each artist page carries the biography held in the archive and links out to every catalogue entry attributed to them.`,
    "",
  ]

  let letter = null
  for (const { artist, workCount } of [...entries].sort((a, b) =>
    a.artist.name.localeCompare(b.artist.name, "es", { sensitivity: "base" }),
  )) {
    const initial = fold(artist.name)[0]?.toUpperCase() ?? "#"
    if (initial !== letter) {
      letter = initial
      parts.push(`## ${initial}`)
    }
    parts.push(`- [[${artist.name}]] _(${workCount})_`)
  }
  parts.push("")

  if (stubs.length) {
    parts.push("## In the archive but with no catalogued work", "")
    for (const name of stubs) parts.push(`- [[${name}]]`)
    parts.push("")
  }

  return `${parts.join("\n").trim()}${provenance()}`
}

function listPage({ heading, intro, items, emptyNote }) {
  const parts = [heading, "", intro, ""]
  if (!items.length) {
    parts.push(emptyNote, "")
  } else {
    for (const line of items) parts.push(`- ${line}`)
    parts.push("")
  }
  return `${parts.join("\n").trim()}${provenance()}`
}

function homePage({ title, standfirst, sections, stats }) {
  const parts = [`# ${title}`, "", standfirst, ""]

  if (stats?.length) {
    parts.push("## At a glance", "", "| | |", "| --- | --- |")
    for (const [label, value] of stats) parts.push(`| ${label} | ${value} |`)
    parts.push("")
  }

  parts.push("## Start here", "")
  // Blank entries are spacers between groups of links, not list items.
  for (const line of sections) {
    if (line.trim()) parts.push(`- ${line}`)
    else parts.push("")
  }
  parts.push("")
  return `${parts.join("\n").trim()}${provenance()}`
}

// --- block rendering --------------------------------------------------------

/**
 * The CMS stores its pages as typed blocks. Only the types this collection
 * uses are handled; anything else is reported so an unhandled block is
 * visible rather than silently dropped.
 */
function renderBlocks(blocks) {
  const out = []
  const unknown = []

  for (const block of blocks) {
    const c = block.content ?? {}
    switch (block.type) {
      case "heading": {
        // Stored as "h1".."h6"; Number("h1") is NaN, so strip the letter first.
        const raw = String(c.level ?? "h2").toLowerCase()
        const parsed = Number.parseInt(raw.replace(/^h/, ""), 10)
        const level = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 2, 1), 6)
        out.push(`${"#".repeat(level)} ${escapeInline(c.text)}`, "")
        break
      }
      case "text": {
        const md = String(c.html ?? "")
          .replace(/<\s*br\s*\/?>/gi, "\n")
          .replace(/<\/(p|div|li|h[1-6])>/gi, "\n\n")
          .replace(/<li[^>]*>/gi, "- ")
          .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
          .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
          .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
          .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
          .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
          .replace(/<[^>]+>/g, "")
          .replace(/[ \t]+\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          // A blank line between list items makes the list render "loose".
          .replace(/\n\n(?=\s*- )/g, "\n")
          .trim()
        if (md) out.push(md, "")
        break
      }
      case "image": {
        if (c.url) {
          out.push(`![${escapeInline(c.alt || c.caption || "")}](${c.url})`)
          if (c.caption) out.push(`_${escapeInline(c.caption)}_`)
          out.push("")
        }
        break
      }
      case "cta": {
        if (c.link && c.text) {
          const href = c.link.startsWith("/") ? SITE_ROOT + c.link : c.link
          out.push(`[${escapeInline(c.text)}](${href})`, "")
        }
        break
      }
      case "contactForm": {
        out.push(
          `Inquiries about works in the collection can be sent from the [contact page on the collection site](${SITE_ROOT}/contact/), or by email to the address on [[Contact]].`,
          "",
        )
        break
      }
      case "hero": {
        if (c.title) out.push(`# ${escapeInline(c.title)}`, "")
        if (c.subtitle) out.push(`_${escapeInline(c.subtitle)}_`, "")
        break
      }
      default:
        if (block.type) unknown.push(block.type)
    }
  }

  return { markdown: out.join("\n").trim(), unknown }
}

// --- assembly ---------------------------------------------------------------

/**
 * Read the database and return the three spaces with their full page trees,
 * parents before children so the importer can insert in one pass.
 */
export async function buildContent(sql) {
  const tenants = await sql`select id, name, slug from tenants where slug = ${TENANT_SLUG} limit 1`
  if (!tenants.length) throw new Error(`No tenant with slug "${TENANT_SLUG}"`)
  const tenant = tenants[0]

  const [productRows, detailRows, artistRows, assetRows, pageRows, blockRows] = await Promise.all([
    sql`select id, name, slug, description, images
        from products where tenant_id = ${tenant.id} and deleted_at is null order by name`,
    sql`select * from artwork_details where tenant_id = ${tenant.id}`,
    sql`select id, slug, name, bio, lifespan, sort_name, artwork_count
        from artists where tenant_id = ${tenant.id} order by name`,
    sql`select id, name, url, alt_text, width, height
        from assets where tenant_id = ${tenant.id}`,
    sql`select id, slug, title, description, is_published, sort_order
        from pages where tenant_id = ${tenant.id} order by sort_order, slug`,
    sql`select page_id, type, content, sort_order, is_visible
        from page_blocks where tenant_id = ${tenant.id} order by sort_order`,
  ])

  // --- images: match the DAM on uploads path, never on name ---
  const assetByPath = new Map()
  for (const asset of assetRows) {
    const path = imagePath(asset.url)
    if (path && !assetByPath.has(path)) assetByPath.set(path, asset)
  }

  // --- artists: exact key first, then the fuzzy pass for name variants ---
  const artistsByKey = new Map()
  for (const artist of artistRows) {
    for (const variant of [artist.name, artist.sort_name, artist.slug?.replace(/-/g, " ")]) {
      const key = nameKey(variant)
      if (key && !artistsByKey.has(key)) artistsByKey.set(key, artist)
    }
  }
  const artistList = [...artistsByKey.values()]

  /**
   * The artist a catalogue row belongs to, or null.
   *
   * Three passes, strongest first. All of them only ever run on rows with no
   * CRV number, so they cannot steal a catalogued artwork.
   *
   *   exact    the name, the sort name or the slug matches key for key
   *   contains the artist's whole name appears inside a longer one — the
   *            catalogue writes "Abismael (Aby) Ruiz" where the artists table
   *            has "Aby Ruiz", and "Jorge “Rito” Cordero Ramos" for
   *            "Jorge “Rito” Cordero"
   *   fuzzy    one typo or a dropped token per word
   */
  const artistForRow = (row) => {
    const detail = row.detail
    // A column holding a whole sentence is upstream corruption, not a name.
    const named = [detail?.artist_name, detail?.artist_sort_name].filter(
      (v) => v && v.length < 60 && !/\n/.test(v),
    )
    const bare = readableName(row.product).replace(/\s*[–—-]\s*\d{4}\s*$/, "").trim()

    for (const candidate of [...named, bare]) {
      const hit = artistsByKey.get(nameKey(candidate))
      if (hit) return hit
    }

    const haystacks = [...named, bare].filter(Boolean)
    for (const artist of artistList) {
      const wanted = tokensAll(artist.name)
      if (wanted.length < 2) continue
      for (const hay of haystacks) {
        const have = tokensAll(hay)
        if (have.length < wanted.length) continue
        const pool = [...have]
        const contained = wanted.every((t) => {
          const i = pool.findIndex((u) => u === t || editDistance(u, t) <= 1)
          if (i < 0) return false
          pool.splice(i, 1)
          return true
        })
        if (contained) return artist
      }
    }

    for (const hay of haystacks) {
      // One word on its own is too short a signal to match on.
      if (tokensAll(hay).length < 2) continue
      const hit = artistList.find((a) => nameSimilarity(tokensAll(hay), tokensAll(a.name)) >= 0.75)
      if (hit) return hit
    }
    return null
  }

  const artistFor = (row) => {
    const detail = row.detail
    for (const variant of [
      detail?.artist_name,
      detail?.artist_sort_name,
      detail?.artist_slug?.replace(/-/g, " "),
    ]) {
      if (!variant) continue
      const hit = artistsByKey.get(nameKey(variant))
      if (hit) return hit
    }
    return null
  }

  const isArtistEntry = (row) => artistForRow(row) !== null

  // --- catalogue entries ---
  const detailByProduct = new Map(detailRows.map((d) => [d.product_id, d]))

  // Two rows are not works at all: the contact page and the collector's own
  // portfolio were imported as products.
  const NON_WORKS = new Set(["contacto", "portfolio"])

  const rows = []
  for (const product of productRows) {
    const detail = detailByProduct.get(product.id) ?? null
    const assets = []
    for (const image of Array.isArray(product.images) ? product.images : []) {
      const asset = assetByPath.get(imagePath(image.url))
      if (asset) assets.push(asset)
    }
    const row = { product, detail, assets, artist: artistFor({ product, detail }) }
    if (!NON_WORKS.has(product.slug)) rows.push(row)
  }

  const buckets = { artwork: [], architecture: [], publication: [], artistEntry: [] }
  for (const row of rows) buckets[classify(row, isArtistEntry)].push(row)

  const ambiguous = []
  for (const row of buckets.architecture) {
    // Architecture decided on a weak signal is worth surfacing.
    const name = readableName(row.product)
    const strong =
      /Construido|No Construido|Restauraci[oó]n|Rehabilitaci[oó]n/i.test(String(row.product.description ?? "")) ||
      /\s[–-]\s*\d{4}\s*$/.test(name)
    if (!strong) ambiguous.push(name)
  }

  // --- unique page titles, per space ---
  // Nexus resolves [[links]] by title across the whole tenant, so a title used
  // in two spaces would merge their backlinks.
  const usedTitles = new Set()
  const uniqueTitle = (preferred, fallback) => {
    const base = String(preferred ?? "").replace(/\s+/g, " ").trim() || fallback
    if (!usedTitles.has(base.toLowerCase())) {
      usedTitles.add(base.toLowerCase())
      return base
    }
    for (let n = 2; ; n++) {
      const candidate = `${base} (${n})`
      if (!usedTitles.has(candidate.toLowerCase())) {
        usedTitles.add(candidate.toLowerCase())
        return candidate
      }
    }
  }

  // Reserve the structural titles so no work can squat on them.
  const artHome = uniqueTitle("The Collector and Art Business home", "Home")
  const aboutTitle = uniqueTitle("About the Collector", "About")
  const exhibitionTitle = uniqueTitle("The Collection at MAC Puerto Rico", "Exhibition")
  const contactTitle = uniqueTitle("Contact", "Contact")
  const artistsTitle = uniqueTitle("Artists", "Artists")
  const unattributedTitle = uniqueTitle("Unattributed works", "Unattributed works")
  const archHome = uniqueTitle("The Architecture Practice home", "Home")
  const archIndexTitle = uniqueTitle("All projects", "All projects")
  const pubHome = uniqueTitle("Research & Publications home", "Home")
  for (const artist of artistRows) usedTitles.add(String(artist.name ?? "").toLowerCase())

  // --- the art space ---
  const artPages = []
  const worksByArtist = new Map()
  const entriesByArtist = new Map()
  const orphans = []
  const orphanArtists = []

  for (const row of buckets.artwork) {
    row.title = uniqueTitle(readableName(row.product), row.product.slug || "Untitled")
    if (row.artist) {
      if (!worksByArtist.has(row.artist.id)) worksByArtist.set(row.artist.id, [])
      worksByArtist.get(row.artist.id).push(row)
    } else {
      orphans.push(row)
    }
  }
  for (const row of buckets.artistEntry) {
    const owner = artistForRow(row)
    if (owner) {
      if (!entriesByArtist.has(owner.id)) entriesByArtist.set(owner.id, [])
      entriesByArtist.get(owner.id).push(row)
    } else {
      // An artist the archive holds a record of but the artists table never
      // learned about — "Abdías Méndez Robles", "Carlos Ortiz Burgos". They
      // get a page of their own rather than being filed as a building.
      orphanArtists.push(row)
    }
  }

  // A synthetic artist record, so these can go through the same page builder.
  const unlistedArtists = orphanArtists.map((row) => {
    const name = readableName(row.product)
    const text = String(row.product.description ?? "").trim()
    // The lifespan sits on its own line under the name, in brackets.
    const lifespan = (text.split("\n").slice(1, 3).join(" ").match(/\([^)]*\)/) ?? [""])[0]
    return {
      id: `unlisted:${row.product.id}`,
      name,
      bio: text,
      lifespan: lifespan || null,
      unlisted: true,
    }
  })
  for (const artist of unlistedArtists) {
    if (!entriesByArtist.has(artist.id)) entriesByArtist.set(artist.id, [])
    entriesByArtist.get(artist.id).push(
      orphanArtists.find((r) => `unlisted:${r.product.id}` === artist.id),
    )
  }

  const artistEntries = [...artistRows, ...unlistedArtists]
    .map((artist) => ({
      artist,
      works: worksByArtist.get(artist.id) ?? [],
      entries: entriesByArtist.get(artist.id) ?? [],
    }))
    .filter((e) => e.works.length || e.entries.length)

  const withWorks = artistEntries.filter((e) => e.works.length)
  const noWorks = artistEntries.filter((e) => !e.works.length)

  artPages.push({
    key: "art:home",
    title: artHome,
    icon: "🏠",
    parent: null,
    content: "",
  })
  artPages.push({ key: "art:artists", title: artistsTitle, icon: "🎨", parent: artHome, content: "" })
  for (const { artist, works, entries } of artistEntries) {
    artPages.push({
      key: `art:artist:${artist.id}`,
      title: artist.name,
      icon: "🧑‍🎨",
      parent: artistsTitle,
      content: artistPage({ artist, works, entries }),
    })
    for (const work of works) {
      artPages.push({
        key: `art:work:${work.product.id}`,
        title: work.title,
        icon: "🖼️",
        parent: artist.name,
        content: artworkPage(work),
      })
    }
  }
  if (orphans.length) {
    artPages.push({
      key: "art:unattributed",
      title: unattributedTitle,
      icon: "❓",
      parent: artHome,
      content: "",
    })
    for (const row of orphans) {
      artPages.push({
        key: `art:work:${row.product.id}`,
        title: row.title,
        icon: "🖼️",
        parent: unattributedTitle,
        content: artworkPage(row),
      })
    }
  }

  // --- the architecture space, grouped by decade ---
  const archPages = [{ key: "arch:home", title: archHome, icon: "🏠", parent: null, content: "" }]
  const decades = new Map()
  for (const row of buckets.architecture) {
    row.title = uniqueTitle(readableName(row.product), row.product.slug || "Untitled")
    const decade = decadeOf(yearOf(row.product, row.detail))
    if (!decades.has(decade)) decades.set(decade, [])
    decades.get(decade).push(row)
  }
  archPages.push({ key: "arch:index", title: archIndexTitle, icon: "🗂️", parent: archHome, content: "" })

  const orderedDecades = [...decades.keys()].sort((a, b) => {
    if (a === "Date not recorded") return 1
    if (b === "Date not recorded") return -1
    return Number(a) - Number(b)
  })
  for (const decade of orderedDecades) {
    const decadeTitle = uniqueTitle(decade, decade)
    const projects = decades.get(decade)
    archPages.push({
      key: `arch:decade:${decade}`,
      title: decadeTitle,
      icon: "📅",
      parent: archIndexTitle,
      content: listPage({
        heading: `## ${decade}`,
        intro:
          decade === "Date not recorded"
            ? "Projects held in the archive with no date recorded."
            : `Projects dated ${decade}.`,
        items: projects
          .slice()
          .sort((a, b) => a.title.localeCompare(b.title, "es", { sensitivity: "base" }))
          .map((p) => {
            const year = yearOf(p.product, p.detail)
            const imgs = p.assets.length ? ` 🖼` : ""
            return `[[${p.title}]]${year ? ` - ${year}` : ""}${imgs}`
          }),
        emptyNote: "_No project is recorded for this decade._",
      }),
    })
    for (const row of projects) {
      archPages.push({
        key: `arch:project:${row.product.id}`,
        title: row.title,
        icon: "🏗️",
        parent: decadeTitle,
        content: projectPage({ product: row.product, detail: row.detail, assets: row.assets, kind: "architecture" }),
      })
    }
  }

  // --- the publications space ---
  const pubPages = [{ key: "pub:home", title: pubHome, icon: "🏠", parent: null, content: "" }]
  for (const row of buckets.publication) {
    row.title = uniqueTitle(readableName(row.product), row.product.slug || "Untitled")
    pubPages.push({
      key: `pub:item:${row.product.id}`,
      title: row.title,
      icon: "📕",
      parent: pubHome,
      content: projectPage({ product: row.product, detail: row.detail, assets: row.assets, kind: "publication" }),
    })
  }

  // --- editorial pages from the CMS ---
  const blocksByPage = new Map()
  for (const block of blockRows) {
    if (block.is_visible === false) continue
    if (!blocksByPage.has(block.page_id)) blocksByPage.set(block.page_id, [])
    blocksByPage.get(block.page_id).push(block)
  }
  const unknownBlockTypes = new Set()
  for (const ref of [
    { slug: "about", title: aboutTitle, icon: "🏛️" },
    { slug: "exhibition", title: exhibitionTitle, icon: "🖼️" },
    { slug: "contact", title: contactTitle, icon: "✉️" },
  ]) {
    const page = pageRows.find((p) => p.slug === ref.slug)
    if (!page) continue
    const { markdown, unknown } = renderBlocks(blocksByPage.get(page.id) ?? [])
    for (const type of unknown) unknownBlockTypes.add(`${ref.slug}:${type}`)
    artPages.push({
      key: `art:ref:${ref.slug}`,
      title: ref.title,
      icon: ref.icon,
      parent: artHome,
      content: `${markdown}\n\n${provenance()}`,
    })
  }

  // --- statistics, then the home pages that quote them ---
  const usedAssetIds = new Set(rows.flatMap((r) => r.assets.map((a) => a.id)))
  const attributed = withWorks.reduce((n, e) => n + e.works.length, 0)

  const stats = {
    artists: withWorks.length,
    artistsWithoutWorks: noWorks.length,
    artworks: attributed + orphans.length,
    attributed,
    unattributed: orphans.length,
    architecture: buckets.architecture.length,
    publications: buckets.publication.length,
    artistEntries: buckets.artistEntry.length,
    images: usedAssetIds.size,
    damAssets: assetRows.length,
  }

  const topArtists = [...withWorks]
    .sort((a, b) => b.works.length - a.works.length || a.artist.name.localeCompare(b.artist.name))
    .slice(0, 15)
  const selected = withWorks
    .flatMap((e) => e.works)
    .filter((w) => w.assets.length > 0)
    .sort((a, b) => String(crvNumber(b.product, b.detail) ?? "").localeCompare(String(crvNumber(a.product, a.detail) ?? ""), "en", { numeric: true }))
    .slice(0, 20)

  artPages[0].content = homePage({
    title: "The Collector and Art Business",
    standfirst:
      "The private archive of architect **Otto Octavio Reyes Casanova** and **Vionnette Veray**, built over more than forty years: one of the most significant surveys of contemporary visual art in Puerto Rico.",
    stats: [
      ["Artists with works in the collection", stats.artists],
      ["Catalogued works", stats.artworks],
      ["Attributed to a known artist", stats.attributed],
      ["No artist on record", stats.unattributed],
      ["Images in the archive", stats.images],
    ],
    sections: [
      "[[About the Collector]] - who assembled the archive, and how",
      "[[The Collection at MAC Puerto Rico]] - the 2008 exhibition at the Museo de Arte Contemporáneo",
      "[[Artists]] - every artist with works in the collection, A-Z",
      "[[Unattributed works]] - catalogued works with no artist on record",
      "[[Contact]] - how to reach the collection",
      "",
      "The architecture is catalogued separately, in [[The Architecture Practice home]], and the monographs and bulletins in [[Research & Publications home]].",
    ],
  })
  artPages.find((p) => p.key === "art:artists").content = artistIndexPage(withWorks, noWorks.map((e) => e.artist.name))
  artPages.find((p) => p.key === "art:unattributed").content = listPage({
    heading: "## Unattributed works",
    intro: `${orphans.length} catalogued works carry no artist, or name one that has no biography in the archive. They are kept here rather than dropped, so the catalogue stays complete.`,
    items: orphans
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title, "es", { sensitivity: "base" }))
      .map((row) => {
        const crv = crvNumber(row.product, row.detail)
        const bits = []
        if (row.detail?.artist_name) bits.push(escapeInline(row.detail.artist_name))
        if (crv) bits.push(`CRV #${crv}`)
        return `[[${row.title}]]${bits.length ? ` - ${bits.join(" · ")}` : ""}`
      }),
    emptyNote: "_Every catalogued work is attributed._",
  })

  archPages[0].content = homePage({
    title: "The Architecture Practice",
    standfirst:
      "Otto Octavio Reyes Casanova's own work: houses, restorations, public buildings and the projects that were never built, documented from the archive.",
    stats: [
      ["Projects catalogued", stats.architecture],
      ["Decades covered", orderedDecades.filter((d) => d !== "Date not recorded").length],
      ["Images in the archive", new Set(buckets.architecture.flatMap((r) => r.assets.map((a) => a.id))).size],
    ],
    sections: [
      "[[All projects]] - every project, grouped by decade",
      "",
      "The art collection is catalogued in [[The Collector and Art Business home]], and the monographs and bulletins in [[Research & Publications home]].",
    ],
  })
  archPages.find((p) => p.key === "arch:index").content = listPage({
    heading: "## All projects",
    intro: `${buckets.architecture.length} projects, grouped by decade.`,
    items: orderedDecades.map((d) => `[[${d}]] - ${decades.get(d).length} project${decades.get(d).length === 1 ? "" : "s"}`),
    emptyNote: "_No project is catalogued._",
  })

  pubPages[0].content = homePage({
    title: "Research & Publications",
    standfirst:
      "Monographs, bulletins, plans and reports held in the archive alongside the collection, including the catalogues and studies of Puerto Rican architecture that document the practice.",
    stats: [
      ["Publications catalogued", stats.publations],
      ["Images in the archive", new Set(buckets.publication.flatMap((r) => r.assets.map((a) => a.id))).size],
    ],
    sections: [
      ...buckets.publication
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title, "es", { sensitivity: "base" }))
        .map((row) => `[[${row.title}]]`),
      "",
      "The art collection is catalogued in [[The Collector and Art Business home]], and the buildings in [[The Architecture Practice home]].",
    ],
  })

  // --- sanity: unique titles, and a parent that exists ---
  for (const space of [
    { name: SPACES[0].name, pages: artPages },
    { name: SPACES[1].name, pages: archPages },
    { name: SPACES[2].name, pages: pubPages },
  ]) {
    const titles = new Set()
    for (const page of space.pages) {
      const key = page.title.toLowerCase()
      if (titles.has(key)) throw new Error(`Duplicate title in ${space.name}: "${page.title}"`)
      titles.add(key)
    }
    for (const page of space.pages) {
      if (page.parent && !titles.has(String(page.parent).toLowerCase())) {
        throw new Error(`"${page.title}" names a missing parent "${page.parent}" in ${space.name}`)
      }
    }
  }

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    spaces: [
      { ...SPACES[0], pages: artPages },
      { ...SPACES[1], pages: archPages },
      { ...SPACES[2], pages: pubPages },
    ],
    stats,
    ambiguousArchitecture: ambiguous,
    unknownBlockTypes,
  }
}
