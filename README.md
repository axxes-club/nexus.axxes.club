# Nexus — knowledge base

Spaces, nested pages, [[wiki links]] with backlinks, version history and ⌘K search for AXXES workspaces (nexus.axxes.club). Tables: `nexus_*` (additive, `scripts/create-tables.sql`). Handshake sign-in. Installable PWA.

## Content

Documentation is written as a content module and imported, so the words can be reviewed without reading any SQL and re-importing is a no-op.

| Script | Writes |
| --- | --- |
| `node scripts/import-tollbooth.mjs [--dry-run]` | The 🛣️ **Tollbooth** space in AXXES CLUB |
| `node scripts/import-reyes-veray.mjs [--dry-run]` | The three Reyes-Veray spaces |
| `node scripts/import-bayamon-educacion.mjs [--dry-run]` | The Bayamón education space |

Each importer is idempotent: it resolves its space by name, matches pages by title, updates in place, snapshots a version only when the text changed, retires pages it no longer owns, and rebuilds the `[[wiki link]]` graph from the final text. `--dry-run` reports exactly what a real run would do and writes nothing.

They also refuse to run if one of their page titles already exists in another space of the same organisation, because `[[links]]` resolve by title across the whole tenant and a duplicate title would silently merge two pages.
