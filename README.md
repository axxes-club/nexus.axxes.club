# Nexus — knowledge base

Spaces, nested pages, [[wiki links]] with backlinks, version history and ⌘K search for AXXES workspaces (nexus.axxes.club). Tables: `nexus_*` (additive, `scripts/create-tables.sql`). Handshake sign-in. Installable PWA.

## Content

Documentation is written as a content module and imported, so the words can be reviewed without reading any SQL and re-importing is a no-op.

| Script | Writes |
| --- | --- |
| `node scripts/import-tollbooth.mjs [--dry-run]` | The 🛣️ **Tollbooth** space in AXXES CLUB |
| `node scripts/import-reyes-veray.mjs [--dry-run]` | The three Reyes-Veray spaces |
| `node scripts/import-bayamon-educacion.mjs [--dry-run]` | The Bayamón education space |
| `node scripts/import-space.mjs <module> [--dry-run]` | Any space, from its content module (below) |
| `node scripts/sync-catalog.mjs [--dry-run]` | [[The AXXES catalog]] in AXXES CLUB, rebuilt from `axxes_product` |

Each importer is idempotent: it resolves its space by name, matches pages by title, updates in place, snapshots a version only when the text changed, retires pages it no longer owns, and rebuilds the `[[wiki link]]` graph from the final text. `--dry-run` reports exactly what a real run would do and writes nothing.

They also refuse to run if one of their page titles already exists in another space of the same organisation, because `[[links]]` resolve by title across the whole tenant and a duplicate title would silently merge two pages.

### `import-space.mjs`

The shared engine, taking a content module as its argument. A module exports `SPACE`, `PAGES` and `TENANT`; a module may instead export `CREATE_TENANT`, in which case the organisation is created on first run along with your owner membership.

```bash
node scripts/import-space.mjs crativo-content.mjs --dry-run
```

| Module | Writes |
| --- | --- |
| `crativo-content.mjs` | The 🎛️ **Crativo** space, in a new **Crativo** organisation |
| `afters-content.mjs` | The 🎟️ **afters** space in AXXES CLUB |
| `builders-content.mjs` | The 🛠️ **AXXES for Builders** space in AXXES CLUB |
| `keel-content.mjs` | The ⚓ **Keel** space in AXXES CLUB |
| `stock-content.mjs` | The 📦 **Stock** space in AXXES CLUB |
| `rooms-content.mjs` | The 🚪 **Rooms** space in AXXES CLUB |

The engine also accepts the older `TENANT_SLUG` + `buildContent()` shape that the Tollbooth and Reyes-Veray modules use, so those can be migrated to the shared engine without changing their words.

### `sync-catalog.mjs`

The catalog page claimed to be generated from `axxes_product` while being a hand-maintained table, and it had drifted: it listed 15 products against 18 rows, and Matter, Relay and AXXES Office were missing from the page describing them. This rebuilds that one page from the table, so it cannot disagree with the catalog again. It also reports any product whose category is not in its `CATEGORY_ORDER`, because that is a bug in the page rather than in the catalog.

### A known collision

`Data model` exists in both the **Matter** and **Tollbooth** spaces. `savePage()` resolves a `[[link]]` to *every* page in the tenant with a matching title, so editing either page in the app links it to both. The importers refuse to add a third; renaming one of the two is the fix, and it is not done.
