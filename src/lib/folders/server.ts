import "server-only"
import { headers } from "next/headers"
import { and, eq, isNull, sql } from "drizzle-orm"
import { db, schema as s } from "@/lib/db"
import { requireContext } from "@/lib/context"
import { signEnvelope } from "./envelope"
import { removedAttachmentIds } from "./markdown"
import { pageAssetSaveStatement, type PageAssetSave } from "./page-assets"

export const foldersOrigin = () => (process.env.FOLDERS_URL || "https://dam.axxes.club").replace(/\/$/, "")
export async function foldersRequest(action: string, data: Record<string, unknown>, cookie?: string): Promise<Response> {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("Folders integration is not configured")
  const token = signEnvelope({ ...data, appKey: "nexus", action, exp: Date.now() + 60_000 }, secret)
  const res = await fetch(`${foldersOrigin()}/api/apps/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: new URL(foldersOrigin()).origin, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ appKey: "nexus", token }), cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok && !(action === "deliver" && res.status >= 300 && res.status < 400)) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || `Folders request failed (${res.status})`)
  }
  return res
}
export async function pageContext(pageId: string, write = false) {
  const ctx = await requireContext()
  if (write && !["owner", "admin", "manager", "member"].includes(ctx.role)) throw new Error("You cannot edit this workspace")
  const [page] = await db.select({ id: s.nexusPages.id, tenantId: s.nexusPages.tenantId }).from(s.nexusPages)
    .innerJoin(s.nexusSpaces, eq(s.nexusSpaces.id, s.nexusPages.spaceId))
    .where(and(eq(s.nexusPages.id, pageId), eq(s.nexusPages.tenantId, ctx.tenant.id), isNull(s.nexusPages.deletedAt), isNull(s.nexusSpaces.deletedAt)))
  if (!page) throw new Error("Page unavailable")
  return { ctx, cookie: (await headers()).get("cookie") || "", recordId: page.id, audienceTenantId: page.tenantId, userId: ctx.userId }
}
export async function detachPageAssets(ids: string[]) {
  if (!ids.length) return
  await db.execute(sql`delete from asset_app_grants where app_key='nexus' and record_id in (${sql.join(ids.map(id => sql`${id}::uuid`), sql`, `)})`)
  await db.execute(sql`delete from asset_app_links where app_key='nexus' and record_id in (${sql.join(ids.map(id => sql`${id}::uuid`), sql`, `)})`)
}
export async function syncPageAssets(previousContent: string, change: Omit<PageAssetSave, "removed">) {
  const candidates = removedAttachmentIds(previousContent, change.content)
  if (!candidates.length) return false
  const result = await db.execute(pageAssetSaveStatement({ ...change, removed: candidates }))
  if (!result.rows.length) throw new Error("Page unavailable")
  return true
}
export async function copyPageAssets(fromId: string, toId: string) {
  const [source] = await db.select({ content: s.nexusPages.content }).from(s.nexusPages).where(eq(s.nexusPages.id, fromId))
  if (!source?.content.includes("/api/folders/assets/")) return
  const context = await pageContext(fromId, true)
  const { cookie, ctx: _ctx, ...identity } = context
  await foldersRequest("copy", { ...identity, toRecordId: toId }, cookie)
  // Bind each copied Markdown reference to the new page's grant.
  try {
    await db.execute(sql`update nexus_pages set content=replace(content, ${`?pageId=${fromId}`}, ${`?pageId=${toId}`}) where id=${toId}::uuid and tenant_id=${context.audienceTenantId}::uuid`)
  } catch (error) { await detachPageAssets([toId]); throw error }
}
