/**
 * Token scopes, kept apart from the token library so the browser can import
 * them: the library is server-only (it touches the database and the secret),
 * but the picker needs the same labels and descriptions or the two drift.
 */
export const SCOPES = [
  { id: "read", label: "Read", detail: "Fetch spaces, pages and search." },
  { id: "write", label: "Write", detail: "Create and update pages." },
  { id: "import", label: "Import", detail: "Bulk-create content from a script." },
] as const

export type TokenScope = (typeof SCOPES)[number]["id"]

export function isScope(value: string): value is TokenScope {
  return SCOPES.some((s) => s.id === value)
}
