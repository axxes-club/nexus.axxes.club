import {wrapAdmission} from '@/lib/security/admission-server';
import { NextRequest } from "next/server"
import { foldersRequest, pageContext } from "@/lib/folders/server"
import { signEnvelope } from "@/lib/folders/envelope"
import QRCode from "qrcode"
import { publicOrigin } from "@/lib/public-origin"

async function POSTHandler(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  try {
    const origin = req.headers.get("origin")
    if (origin && origin !== req.nextUrl.origin && origin !== publicOrigin(req) && origin !== process.env.BETTER_AUTH_URL?.replace(/\/$/, "")) return Response.json({ error: "Request origin is not allowed" }, { status: 403 })
    const { action } = await params
    if (!["destinations", "authorize", "assets", "attach", "uploads", "handoff"].includes(action)) return Response.json({ error: "Unknown action" }, { status: 404 })
    const body = await req.json()
    if (typeof body.pageId !== "string") return Response.json({ error: "Page required" }, { status: 400 })
    const context = await pageContext(body.pageId, action !== "assets" && action !== "destinations" && action !== "uploads")
    const { cookie, ctx: _ctx, ...identity } = context
    if (action === "handoff") {
      const res = await foldersRequest("authorize", { ...body, ...identity }, cookie)
      const authorization = await res.json()
      const token = signEnvelope({ ...identity, ...authorization, pageId: body.pageId, appKey: "nexus", action: "phone-upload", exp: new Date(authorization.expiresAt).getTime() }, process.env.BETTER_AUTH_SECRET || "")
      const url = `${publicOrigin(req)}/upload/${token}`
      return Response.json({ ...authorization, url, qr: await QRCode.toDataURL(url, { margin: 2, width: 240 }) }, { headers: { "Cache-Control": "private, no-store" } })
    }
    const res = await foldersRequest(action, { ...body, ...identity }, cookie)
    return Response.json(await res.json(), { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Folders unavailable" }, { status: 400 })
  }
}

export const POST=wrapAdmission(POSTHandler,'src/app/api/folders/[action]/route.ts'+':POST',3000);
