"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { and, eq, isNull } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { ORG_COOKIE } from "@/lib/context"

/**
 * Change which organization this browser is working in.
 *
 * The membership is re-checked here rather than trusted from the client. The
 * cookie is a preference and must never be a way in: a hand-edited cookie
 * naming an organization the person does not belong to is simply refused.
 */
export async function switchOrganization(tenantId: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return

  const [membership] = await db
    .select({ id: schema.tenantMemberships.id })
    .from(schema.tenantMemberships)
    .where(
      and(
        eq(schema.tenantMemberships.userId, session.user.id),
        eq(schema.tenantMemberships.tenantId, tenantId),
        isNull(schema.tenantMemberships.deletedAt),
      ),
    )
    .limit(1)

  if (!membership) return

  const secure = (await headers()).get("x-forwarded-proto") === "https"
  ;(await cookies()).set(ORG_COOKIE, tenantId, {
    httpOnly: true,      // a preference no page needs to read
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
}

/**
 * Switch organization and land on `path` afterwards.
 *
 * Used when someone follows a link to a page that lives in a workspace they
 * are not currently looking at. Re-requesting the same URL after the cookie is
 * set is the whole point: the person asked for that page, so that is where they
 * should end up, not on a dashboard they then have to navigate again.
 *
 * `path` is only ever a path the app itself built, and it is normalised to a
 * single leading slash with no protocol, so a hand-edited value cannot turn
 * this into an open redirect.
 */
export async function openInOrganization(tenantId: string, path: string): Promise<void> {
  await switchOrganization(tenantId)
  const safe = path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard"
  redirect(safe)
}
