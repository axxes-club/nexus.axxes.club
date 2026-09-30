import "server-only"
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm"
import { db, schema as s } from "@/lib/db"
import type { LinkT, PageT, SpaceT, TreePage } from "./types"

export async function listSpaces(tenantId: string): Promise<(SpaceT & { pages: number })[]> {
  const sp = s.nexusSpaces
  return db
    .select({
      id: sp.id, name: sp.name, icon: sp.icon, description: sp.description,
      pages: sql<number>`(select count(*) from nexus_pages p where p.space_id = "nexus_spaces"."id" and p.deleted_at is null)`.mapWith(Number),
    })
    .from(sp)
    .where(and(eq(sp.tenantId, tenantId), isNull(sp.deletedAt)))
    .orderBy(asc(sp.name))
}

export async function getSpace(tenantId: string, spaceId: string) {
  const [space] = await db.select().from(s.nexusSpaces).where(and(eq(s.nexusSpaces.id, spaceId), eq(s.nexusSpaces.tenantId, tenantId), isNull(s.nexusSpaces.deletedAt))).catch(() => [])
  return space ?? null
}

export async function spaceTree(spaceId: string): Promise<TreePage[]> {
  const p = s.nexusPages
  return db
    .select({ id: p.id, parentId: p.parentId, title: p.title, icon: p.icon, position: p.position })
    .from(p)
    .where(and(eq(p.spaceId, spaceId), isNull(p.deletedAt)))
    .orderBy(asc(p.position), asc(p.createdAt))
}

export async function getPage(tenantId: string, pageId: string): Promise<PageT | null> {
  const [row] = await db
    .select({ page: s.nexusPages, updatedBy: s.user.name })
    .from(s.nexusPages)
    .leftJoin(s.user, eq(s.user.id, s.nexusPages.updatedById))
    .where(and(eq(s.nexusPages.id, pageId), eq(s.nexusPages.tenantId, tenantId), isNull(s.nexusPages.deletedAt)))
    .catch(() => [])
  if (!row) return null
  const { page } = row
  return { id: page.id, spaceId: page.spaceId, parentId: page.parentId, title: page.title, icon: page.icon, content: page.content, updatedAt: page.updatedAt.toISOString(), updatedBy: row.updatedBy }
}

export async function backlinks(tenantId: string, pageId: string): Promise<LinkT[]> {
  return db
    .select({ id: s.nexusPages.id, title: s.nexusPages.title, icon: s.nexusPages.icon, spaceId: s.nexusPages.spaceId })
    .from(s.nexusLinks)
    .innerJoin(s.nexusPages, eq(s.nexusPages.id, s.nexusLinks.fromPageId))
    .where(and(eq(s.nexusLinks.toPageId, pageId), eq(s.nexusPages.tenantId, tenantId), isNull(s.nexusPages.deletedAt)))
    .orderBy(asc(s.nexusPages.title))
}

// Title → page lookup for rendering [[links]] (tenant-wide)
export async function titleIndex(tenantId: string, titles: string[]) {
  if (!titles.length) return new Map<string, LinkT>()
  const rows = await db
    .select({ id: s.nexusPages.id, title: s.nexusPages.title, icon: s.nexusPages.icon, spaceId: s.nexusPages.spaceId })
    .from(s.nexusPages)
    .where(and(eq(s.nexusPages.tenantId, tenantId), isNull(s.nexusPages.deletedAt), inArray(sql`lower(${s.nexusPages.title})`, titles)))
  return new Map(rows.map((r) => [r.title.toLowerCase(), r]))
}

export async function recentPages(tenantId: string, limit = 12) {
  return db
    .select({ id: s.nexusPages.id, title: s.nexusPages.title, icon: s.nexusPages.icon, spaceId: s.nexusPages.spaceId, updatedAt: s.nexusPages.updatedAt, space: s.nexusSpaces.name })
    .from(s.nexusPages)
    .innerJoin(s.nexusSpaces, eq(s.nexusSpaces.id, s.nexusPages.spaceId))
    .where(and(eq(s.nexusPages.tenantId, tenantId), isNull(s.nexusPages.deletedAt), isNull(s.nexusSpaces.deletedAt)))
    .orderBy(desc(s.nexusPages.updatedAt))
    .limit(limit)
}

export async function searchPages(tenantId: string, q: string) {
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  return db
    .select({
      id: s.nexusPages.id, title: s.nexusPages.title, icon: s.nexusPages.icon, spaceId: s.nexusPages.spaceId, space: s.nexusSpaces.name,
      snippet: sql<string>`substring(${s.nexusPages.content} from greatest(1, position(lower(${q}) in lower(${s.nexusPages.content})) - 40) for 140)`,
    })
    .from(s.nexusPages)
    .innerJoin(s.nexusSpaces, eq(s.nexusSpaces.id, s.nexusPages.spaceId))
    .where(and(eq(s.nexusPages.tenantId, tenantId), isNull(s.nexusPages.deletedAt), isNull(s.nexusSpaces.deletedAt), or(ilike(s.nexusPages.title, pattern), ilike(s.nexusPages.content, pattern))))
    .orderBy(sql`case when ${s.nexusPages.title} ilike ${pattern} then 0 else 1 end`, desc(s.nexusPages.updatedAt))
    .limit(20)
}

export async function pageVersions(pageId: string) {
  return db
    .select({ id: s.nexusPageVersions.id, title: s.nexusPageVersions.title, createdAt: s.nexusPageVersions.createdAt, author: s.user.name, size: sql<number>`length(${s.nexusPageVersions.content})`.mapWith(Number) })
    .from(s.nexusPageVersions)
    .leftJoin(s.user, eq(s.user.id, s.nexusPageVersions.authorId))
    .where(eq(s.nexusPageVersions.pageId, pageId))
    .orderBy(desc(s.nexusPageVersions.createdAt))
    .limit(50)
}

// --- finding something in another organization -----------------------------

/**
 * Which of this person's *other* organizations holds a page they just asked
 * for?
 *
 * The organization is chosen per browser, not per page: a cookie picks it, and
 * when there is no cookie the app falls back to whichever membership is marked
 * primary. So the commonest way to be told "not found" is not that the page is
 * missing — it is that it belongs to a workspace you are a member of but are
 * not currently looking at. A bare 404 makes that look like the page is gone.
 *
 * The search is restricted to organizations the person is a live member of, so
 * this can only ever name something they are already entitled to see. If they
 * are not a member anywhere, it returns null and the caller shows a plain 404.
 */
export async function findPageInOtherOrg(userId: string, pageId: string) {
  const [row] = await db
    .select({
      tenantId: s.tenants.id,
      tenantName: s.tenants.name,
      tenantSlug: s.tenants.slug,
      spaceId: s.nexusSpaces.id,
      spaceName: s.nexusSpaces.name,
      spaceIcon: s.nexusSpaces.icon,
      pageTitle: s.nexusPages.title,
    })
    .from(s.nexusPages)
    .innerJoin(s.nexusSpaces, eq(s.nexusSpaces.id, s.nexusPages.spaceId))
    .innerJoin(s.tenants, eq(s.tenants.id, s.nexusPages.tenantId))
    .innerJoin(
      s.tenantMemberships,
      and(eq(s.tenantMemberships.tenantId, s.tenants.id), eq(s.tenantMemberships.userId, userId)),
    )
    .where(
      and(
        eq(s.nexusPages.id, pageId),
        isNull(s.nexusPages.deletedAt),
        isNull(s.nexusSpaces.deletedAt),
        isNull(s.tenants.deletedAt),
        isNull(s.tenantMemberships.deletedAt),
      ),
    )
    .limit(1)
  return row ?? null
}

/** The same question about a space rather than a page. */
export async function findSpaceInOtherOrg(userId: string, spaceId: string) {
  const [row] = await db
    .select({
      tenantId: s.tenants.id,
      tenantName: s.tenants.name,
      tenantSlug: s.tenants.slug,
      spaceId: s.nexusSpaces.id,
      spaceName: s.nexusSpaces.name,
      spaceIcon: s.nexusSpaces.icon,
    })
    .from(s.nexusSpaces)
    .innerJoin(s.tenants, eq(s.tenants.id, s.nexusSpaces.tenantId))
    .innerJoin(
      s.tenantMemberships,
      and(eq(s.tenantMemberships.tenantId, s.tenants.id), eq(s.tenantMemberships.userId, userId)),
    )
    .where(
      and(
        eq(s.nexusSpaces.id, spaceId),
        isNull(s.nexusSpaces.deletedAt),
        isNull(s.tenants.deletedAt),
        isNull(s.tenantMemberships.deletedAt),
      ),
    )
    .limit(1)
  return row ?? null
}
