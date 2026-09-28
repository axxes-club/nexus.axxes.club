"use server"

import { cookies, headers } from "next/headers"
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
