import "server-only"
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { and, desc, eq, isNull } from "drizzle-orm"
import { db, schema } from "@/lib/db"

/**
 * Personal API tokens.
 *
 * The shape a token takes is the part people get wrong, so it is worth
 * stating plainly:
 *
 *   nxk_<id>_<secret>      what a person pastes
 *
 * The secret half is 32 random bytes and is shown exactly once. Only its
 * SHA-256 is stored. Lookup is by the non-secret id (an index, not a scan);
 * the constant-time compare is on the hash, so a wrong guess costs the same
 * as a right one.
 *
 * A token is scoped to the tenant and the role of the person who made it.
 * It cannot reach a page they could not reach, and revoking them revokes
 * every token they hold.
 */

const SECRET_BYTES = 32
const ID_BYTES = 9
const ID_HEX_LENGTH = ID_BYTES * 2
export const TOKEN_PREFIX = "nxk"

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

export function newToken(): { id: string; secret: string; token: string; hash: string } {
  const id = randomBytes(ID_BYTES).toString("hex")
  const secret = randomBytes(SECRET_BYTES).toString("base64url")
  return { id, secret, token: `${TOKEN_PREFIX}_${id}_${secret}`, hash: sha256(secret) }
}

/**
 * Pull the id out of a token.
 *
 * Splitting the whole string on "_" looks obvious and is wrong: base64url
 * emits "_" as a character, and about half of all secrets contain one, so a
 * split yields four parts and the token is rejected. The id is a fixed-length
 * hex run right after the prefix, so its end is a position, not a separator.
 */
export function tokenIdFrom(token: string): string | null {
  const head = `${TOKEN_PREFIX}_`
  if (!token.startsWith(head)) return null
  const rest = token.slice(head.length)
  // 18 hex characters (9 bytes), then the separator, then the secret.
  const id = rest.slice(0, ID_HEX_LENGTH)
  if (id.length !== ID_HEX_LENGTH || !/^[0-9a-f]+$/.test(id)) return null
  if (rest[ID_HEX_LENGTH] !== "_") return null
  const secret = rest.slice(ID_HEX_LENGTH + 1)
  return secret.length > 0 ? id : null
}

export function hashFromSecret(secret: string): string {
  return sha256(secret)
}

/** Constant-time, so a wrong secret cannot be found by timing the answer. */
export function secretMatches(candidate: string, storedHash: string): boolean {
  const a = Buffer.from(sha256(candidate), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function createToken(input: {
  userId: string;
  tenantId: string;
  name: string;
  scopes: string[];
  expiresAt?: Date | null;
}) {
  const { id, token, hash } = newToken();
  const [row] = await db
    .insert(schema.apiTokens)
    .values({
      id,
      userId: input.userId,
      tenantId: input.tenantId,
      name: input.name,
      hash,
      prefix: `${TOKEN_PREFIX}_${id.slice(0, 6)}`,
      scopes: input.scopes,
      isActive: true,
      expiresAt: input.expiresAt ?? null,
    })
    .returning();
  return { row, token };
}

/** Live tokens for a person, newest first. Never returns the hash. */
export async function listTokens(userId: string) {
  return db
    .select({
      id: schema.apiTokens.id,
      name: schema.apiTokens.name,
      prefix: schema.apiTokens.prefix,
      scopes: schema.apiTokens.scopes,
      lastUsedAt: schema.apiTokens.lastUsedAt,
      useCount: schema.apiTokens.useCount,
      expiresAt: schema.apiTokens.expiresAt,
      createdAt: schema.apiTokens.createdAt,
    })
    .from(schema.apiTokens)
    .where(and(eq(schema.apiTokens.userId, userId), isNull(schema.apiTokens.revokedAt)))
    .orderBy(desc(schema.apiTokens.createdAt));
}

/** Revoke. Kept as a row (not deleted) so use history survives. */
export async function revokeToken(userId: string, tokenId: string) {
  await db
    .update(schema.apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.apiTokens.id, tokenId), eq(schema.apiTokens.userId, userId)));
}

/**
 * Resolve a bearer token to the access it grants, or null.
 * Expired, revoked and unknown all return null, and callers must not tell
 * those apart.
 */
export async function resolveToken(raw: string) {
  const id = tokenIdFrom(raw);
  if (!id) return null;

  const [row] = await db
    .select()
    .from(schema.apiTokens)
    .where(eq(schema.apiTokens.id, id))
    .limit(1);

  if (!row || row.revokedAt || !row.hash) return null;
  if (row.isActive === false) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;

  const secret = raw.slice(`${TOKEN_PREFIX}_`.length + ID_HEX_LENGTH + 1);
  if (!secretMatches(secret, row.hash)) return null;

  return row
}

/** Count a use. Best effort: a failed audit write must not fail the request. */
export async function touchToken(id: string, ip?: string) {
  try {
    const { sql } = await import("drizzle-orm");
    await db
      .update(schema.apiTokens)
      .set({ lastUsedAt: new Date(), lastUsedIp: ip ?? null, useCount: sql`${schema.apiTokens.useCount} + 1` })
      .where(eq(schema.apiTokens.id, id));
  } catch {
    /* auditing is not worth failing a request over */
  }
}

// Re-exported so callers that already import the token library get the
// scopes without needing a second import.
export { SCOPES, isScope, type TokenScope } from "@/lib/developer/scopes"
