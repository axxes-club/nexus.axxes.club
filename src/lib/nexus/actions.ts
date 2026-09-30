"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import { db, schema as s } from "@/lib/db"
import { requireContext } from "@/lib/context"
import { linkedTitlesOutsideCode } from "./links"
import { searchPages } from "./data"
import { assertMutationRole, descendantIds, duplicateWithCleanup } from "./management"
import { copyPageAssets, detachPageAssets, syncPageAssets } from "@/lib/folders/server"

const SNAPSHOT_EVERY_MS = 10 * 60 * 1000

async function spaceFor(spaceId: string) {
  const ctx = await requireContext()
  assertMutationRole(ctx.role)
  const [space] = await db.select().from(s.nexusSpaces).where(and(eq(s.nexusSpaces.id, spaceId), eq(s.nexusSpaces.tenantId, ctx.tenant.id), isNull(s.nexusSpaces.deletedAt)))
  if (!space) throw new Error("Space not found")
  return { ctx, space }
}

async function pageFor(pageId: string) {
  const ctx = await requireContext()
  assertMutationRole(ctx.role)
  const [page] = await db.select().from(s.nexusPages).where(and(eq(s.nexusPages.id, pageId), eq(s.nexusPages.tenantId, ctx.tenant.id), isNull(s.nexusPages.deletedAt)))
  if (!page) throw new Error("Page not found")
  await spaceFor(page.spaceId)
  return { ctx, page }
}

const pagePath = (spaceId: string, pageId: string) => `/dashboard/s/${spaceId}/${pageId}`

// Pages that already mention [[title]] start linking here once the page exists (or is renamed to it)
async function backfillLinksTo(tenantId: string, pageId: string, title: string) {
  const needle = `%[[${title.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const candidates = await db
    .select({ id: s.nexusPages.id, content: s.nexusPages.content })
    .from(s.nexusPages)
    .where(and(eq(s.nexusPages.tenantId, tenantId), isNull(s.nexusPages.deletedAt), sql`${s.nexusPages.content} ilike ${needle}`))
  const from = candidates.filter((c) => c.id !== pageId && linkedTitlesOutsideCode(c.content).includes(title.trim().toLowerCase()))
  if (from.length) await db.insert(s.nexusLinks).values(from.map((c) => ({ fromPageId: c.id, toPageId: pageId }))).onConflictDoNothing()
}

export async function createSpace(form: FormData) {
  const ctx = await requireContext()
  assertMutationRole(ctx.role)
  const name = String(form.get("name") ?? "").trim().slice(0, 80)
  if (!name) throw new Error("Name the space")
  const icon = String(form.get("icon") ?? "").trim().slice(0, 4) || "📘"
  const [space] = await db.insert(s.nexusSpaces).values({ tenantId: ctx.tenant.id, name, icon, createdById: ctx.userId }).returning()
  const [home] = await db
    .insert(s.nexusPages)
    .values({
      tenantId: ctx.tenant.id,
      spaceId: space.id,
      title: `${name} home`,
      icon: "🏠",
      content: `# Welcome to ${name}\n\nThis is the home page for the space. Add pages from the sidebar. To link one page to another, wrap its title in double square brackets, like \`[[Page title]]\`.\n\n- Use **⌘K** to search everything\n- Right-click any page in the sidebar for more options\n`,
      createdById: ctx.userId,
      updatedById: ctx.userId,
    })
    .returning()
  redirect(pagePath(space.id, home.id))
}

export async function createPage(spaceId: string, parentId: string | null, title = "Untitled") {
  const { ctx, space } = await spaceFor(spaceId)
  if (parentId) {
    const [parent] = await db.select({ id: s.nexusPages.id }).from(s.nexusPages).where(and(eq(s.nexusPages.id, parentId), eq(s.nexusPages.spaceId, space.id), eq(s.nexusPages.tenantId, ctx.tenant.id), isNull(s.nexusPages.deletedAt)))
    if (!parent) throw new Error("Parent page not found")
  }
  const [{ pos }] = await db
    .select({ pos: sql<number>`coalesce(max(${s.nexusPages.position}), -1)`.mapWith(Number) })
    .from(s.nexusPages)
    .where(and(eq(s.nexusPages.spaceId, space.id), parentId ? eq(s.nexusPages.parentId, parentId) : isNull(s.nexusPages.parentId)))
  const [page] = await db
    .insert(s.nexusPages)
    .values({ tenantId: ctx.tenant.id, spaceId: space.id, parentId, title: title.trim().slice(0, 200) || "Untitled", position: pos + 1, createdById: ctx.userId, updatedById: ctx.userId })
    .returning()
  await backfillLinksTo(ctx.tenant.id, page.id, page.title)
  revalidatePath(`/dashboard/s/${space.id}`, "layout")
  return { id: page.id, href: pagePath(space.id, page.id) }
}

// Autosave target: updates the page, snapshots a version now and then, and rebuilds its [[links]]
export async function savePage(pageId: string, patch: { title?: string; content?: string; icon?: string | null }) {
  const { ctx, page } = await pageFor(pageId)
  const title = patch.title !== undefined ? patch.title.trim().slice(0, 200) || "Untitled" : page.title
  const content = patch.content !== undefined ? patch.content.slice(0, 500_000) : page.content

  const [last] = await db.select({ createdAt: s.nexusPageVersions.createdAt }).from(s.nexusPageVersions).where(eq(s.nexusPageVersions.pageId, page.id)).orderBy(desc(s.nexusPageVersions.createdAt)).limit(1)
  const changedALot = Math.abs(content.length - page.content.length) > 400
  if ((page.content || page.title !== "Untitled") && (!last || Date.now() - last.createdAt.getTime() > SNAPSHOT_EVERY_MS || changedALot) && (content !== page.content || title !== page.title)) {
    await db.insert(s.nexusPageVersions).values({ pageId: page.id, title: page.title, content: page.content, authorId: page.updatedById ?? page.createdById })
  }

  const savedWithAssets = patch.content !== undefined && await syncPageAssets(page.content, { pageId: page.id, tenantId: page.tenantId, title, content, userId: ctx.userId, ...(patch.icon !== undefined ? { icon: patch.icon?.slice(0, 16) || null } : {}) })
  if (!savedWithAssets) await db
    .update(s.nexusPages)
    .set({ title, content, ...(patch.icon !== undefined ? { icon: patch.icon?.slice(0, 16) || null } : {}), updatedById: ctx.userId, updatedAt: new Date() })
    .where(eq(s.nexusPages.id, page.id))

  if (patch.content !== undefined) {
    const titles = linkedTitlesOutsideCode(content)
    const targets = titles.length
      ? await db.select({ id: s.nexusPages.id }).from(s.nexusPages).where(and(eq(s.nexusPages.tenantId, ctx.tenant.id), isNull(s.nexusPages.deletedAt), inArray(sql`lower(${s.nexusPages.title})`, titles)))
      : []
    await db.delete(s.nexusLinks).where(eq(s.nexusLinks.fromPageId, page.id))
    const toIds = targets.map((t) => t.id).filter((id) => id !== page.id)
    if (toIds.length) await db.insert(s.nexusLinks).values(toIds.map((toPageId) => ({ fromPageId: page.id, toPageId }))).onConflictDoNothing()
  }
  if (patch.title !== undefined && title !== page.title) await backfillLinksTo(ctx.tenant.id, page.id, title)
  if (patch.title !== undefined || patch.icon !== undefined) revalidatePath(`/dashboard/s/${page.spaceId}`, "layout")
  return { savedAt: new Date().toISOString() }
}

export async function renamePage(pageId: string, title: string) {
  await savePage(pageId, { title })
}

export async function movePage(pageId: string, newParentId: string | null) {
  const { page } = await pageFor(pageId)
  // Refuse to move a page under itself or one of its descendants
  const visited = new Set<string>()
  let cursor = newParentId
  while (cursor) {
    if (cursor === page.id || visited.has(cursor)) throw new Error("A page can't go inside itself or its descendants")
    visited.add(cursor)
    const [p] = await db.select({ parentId: s.nexusPages.parentId }).from(s.nexusPages).where(and(eq(s.nexusPages.id, cursor), eq(s.nexusPages.spaceId, page.spaceId), eq(s.nexusPages.tenantId, page.tenantId), isNull(s.nexusPages.deletedAt)))
    if (!p) throw new Error("Pick an available page in the same space")
    cursor = p.parentId
  }
  await db.update(s.nexusPages).set({ parentId: newParentId, updatedAt: new Date() }).where(eq(s.nexusPages.id, page.id))
  revalidatePath(`/dashboard/s/${page.spaceId}`, "layout")
}

export async function deletePage(pageId: string) {
  const { ctx, page } = await pageFor(pageId)
  assertMutationRole(ctx.role, true)
  const pages = await db.select({ id: s.nexusPages.id, parentId: s.nexusPages.parentId }).from(s.nexusPages).where(and(eq(s.nexusPages.spaceId, page.spaceId), eq(s.nexusPages.tenantId, page.tenantId), isNull(s.nexusPages.deletedAt)))
  const ids = [...descendantIds(pages, page.id)]
  await detachPageAssets(ids)
  await db.update(s.nexusPages).set({ deletedAt: new Date() }).where(and(eq(s.nexusPages.tenantId, page.tenantId), eq(s.nexusPages.spaceId, page.spaceId), inArray(s.nexusPages.id, ids)))
  await db.delete(s.nexusLinks).where(inArray(s.nexusLinks.fromPageId, ids))
  revalidatePath(`/dashboard/s/${page.spaceId}`, "layout")
  return { deleted: ids.length }
}

export async function restoreVersion(pageId: string, versionId: string) {
  const { page } = await pageFor(pageId)
  const [v] = await db.select().from(s.nexusPageVersions).where(and(eq(s.nexusPageVersions.id, versionId), eq(s.nexusPageVersions.pageId, page.id)))
  if (!v) throw new Error("Version not found")
  // The current text becomes a version too, so a restore can itself be undone
  await db.insert(s.nexusPageVersions).values({ pageId: page.id, title: page.title, content: page.content, authorId: page.updatedById ?? page.createdById })
  await savePage(page.id, { title: v.title, content: v.content })
  revalidatePath(pagePath(page.spaceId, page.id))
}

export async function search(q: string) {
  const ctx = await requireContext()
  if (q.trim().length < 2) return []
  return searchPages(ctx.tenant.id, q.trim().slice(0, 100))
}

export async function updateSpace(id: string, patch: { name: string; icon: string; description: string }) {
  const { space } = await spaceFor(id)
  const name = patch.name.trim().slice(0, 80)
  if (!name) throw new Error("Name the space")
  await db.update(s.nexusSpaces).set({ name, icon: patch.icon.trim().slice(0, 16) || "📘", description: patch.description.trim().slice(0, 2000) || null }).where(eq(s.nexusSpaces.id, space.id))
  revalidatePath("/dashboard", "layout")
}

export async function deleteSpace(id: string) {
  const { ctx, space } = await spaceFor(id)
  assertMutationRole(ctx.role, true)
  const pages = await db.select({ id: s.nexusPages.id }).from(s.nexusPages).where(and(eq(s.nexusPages.spaceId, space.id), eq(s.nexusPages.tenantId, ctx.tenant.id), isNull(s.nexusPages.deletedAt)))
  const ids = pages.map(p => p.id)
  await detachPageAssets(ids)
  if (ids.length) {
    await db.update(s.nexusPages).set({ deletedAt: new Date() }).where(inArray(s.nexusPages.id, ids))
    await db.delete(s.nexusLinks).where(inArray(s.nexusLinks.fromPageId, ids))
  }
  await db.update(s.nexusSpaces).set({ deletedAt: new Date() }).where(eq(s.nexusSpaces.id, space.id))
  revalidatePath("/dashboard", "layout")
}

export async function duplicatePage(id: string) {
  const { page } = await pageFor(id)
  const copy = await duplicateWithCleanup(
    () => createPage(page.spaceId, page.parentId, `${page.title} (copy)`),
    async copy => {
      await savePage(copy.id, { content: page.content, icon: page.icon })
      await copyPageAssets(page.id, copy.id)
    },
    async copy => {
      await db.update(s.nexusPages).set({ deletedAt: new Date() }).where(and(eq(s.nexusPages.id, copy.id), eq(s.nexusPages.tenantId, page.tenantId)))
      await db.delete(s.nexusLinks).where(inArray(s.nexusLinks.fromPageId, [copy.id]))
      revalidatePath(`/dashboard/s/${page.spaceId}`, "layout")
    },
  )
  revalidatePath(`/dashboard/s/${page.spaceId}`, "layout")
  return copy
}
