import { headers } from "next/headers"
import { auth, HANDSHAKE_URL } from "@/lib/auth"
import { verifyEnvelope } from "@/lib/folders/envelope"
import { PhoneUpload } from "./phone-upload"
import { getContext } from "@/lib/context"
import { findPageInOtherOrg } from "@/lib/nexus/data"
import { WrongOrganization } from "@/components/nexus/wrong-organization"

export default async function PhoneUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const authorization = verifyEnvelope(token, process.env.BETTER_AUTH_SECRET || "", "nexus")
  if (!authorization || authorization.action !== "phone-upload") return <main className="mx-auto max-w-md p-6"><h1 className="text-xl font-semibold">This upload link has expired</h1><p className="mt-3 text-muted">Open the upload picker on your desktop to create a new link.</p></main>
  const h = await headers()
  const session = await auth.api.getSession({ headers: h })
  if (!session || session.user.id !== authorization.userId) {
    const origin = process.env.BETTER_AUTH_URL || "https://nexus.axxes.club"
    const returnUrl = `${origin.replace(/\/$/, "")}/upload/${token}`
    return <main className="mx-auto max-w-md p-6"><h1 className="text-xl font-semibold">Upload to Nexus</h1><p className="mt-3 text-muted">Sign in with the same account as your desktop, then reopen this link.</p><a href={HANDSHAKE_URL ? `${HANDSHAKE_URL}/sign-in?redirect=${encodeURIComponent(returnUrl)}` : "/sign-in"} className="btn-primary mt-5">Sign in</a></main>
  }
  const ctx = await getContext()
  if (ctx && ctx.tenant.id !== authorization.audienceTenantId) {
    const elsewhere = await findPageInOtherOrg(ctx.userId, String(authorization.pageId))
    if (elsewhere) return <WrongOrganization elsewhere={{ ...elsewhere, pageId: String(authorization.pageId) }} currentName={ctx.tenant.name} returnTo={`/upload/${token}`} />
  }
  return <PhoneUpload pageId={String(authorization.pageId)} libraryId={String(authorization.libraryId)} folder={String(authorization.folder)} intentId={String(authorization.intentId)} expiresAt={new Date(authorization.exp).toISOString()} />
}
