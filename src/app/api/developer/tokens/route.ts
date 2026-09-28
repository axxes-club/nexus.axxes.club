import { NextResponse } from "next/server"
import { requireContext } from "@/lib/context"
import { createToken, isScope, listTokens, revokeToken, type TokenScope } from "@/lib/developer/tokens"

export const dynamic = "force-dynamic"

/** GET — the caller's live tokens. Never includes a secret. */
export async function GET() {
  const ctx = await requireContext()
  return NextResponse.json({ tokens: await listTokens(ctx.userId) })
}

/**
 * POST — mint a token.
 *
 * A token inherits the caller's tenant and role, so there is no scope here
 * that grants more than the person already has. `scopes` narrows; it never
 * widens.
 */
export async function POST(req: Request) {
  const ctx = await requireContext()
  const body = await req.json().catch(() => ({}))

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) {
    return NextResponse.json({ message: "Give the token a name so you can tell them apart later." }, { status: 400 })
  }
  if (name.length > 80) {
    return NextResponse.json({ message: "That name is too long." }, { status: 400 })
  }

  const requested: string[] = Array.isArray(body.scopes) ? body.scopes : []
  const scopes: TokenScope[] = requested.filter(isScope)
  if (requested.length !== scopes.length) {
    return NextResponse.json({ message: "Unknown scope." }, { status: 400 })
  }

  // An empty scope list means "everything its owner can do", which is the
  // default a developer expects from a token they just made.
  let expiresAt: Date | null = null
  if (body.expiresInDays) {
    const days = Number(body.expiresInDays)
    if (!Number.isFinite(days) || days <= 0 || days > 365) {
      return NextResponse.json({ message: "Expiry must be between 1 and 365 days." }, { status: 400 })
    }
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  }

  const { row, token } = await createToken({
    userId: ctx.userId,
    tenantId: ctx.tenant.id,
    name,
    scopes,
    expiresAt,
  })

  // The only time the secret is ever returned.
  return NextResponse.json(
    { token: { id: row.id, name: row.name, prefix: row.prefix, scopes: row.scopes, createdAt: row.createdAt, expiresAt: row.expiresAt }, secret: token },
    { status: 201 },
  )
}

/** DELETE — revoke by ?id=. Revoked, not deleted, so history survives. */
export async function DELETE(req: Request) {
  const ctx = await requireContext()
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ message: "id is required" }, { status: 400 })
  await revokeToken(ctx.userId, id)
  return NextResponse.json({ ok: true })
}
