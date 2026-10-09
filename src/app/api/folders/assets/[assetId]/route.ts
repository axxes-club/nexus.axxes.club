import {wrapAdmission} from '@/lib/security/admission-server';
import { NextRequest } from "next/server"
import { foldersRequest, pageContext } from "@/lib/folders/server"

async function GETHandler(req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await params
    const pageId = req.nextUrl.searchParams.get("pageId")
    if (!pageId) return new Response("Attachment unavailable", { status: 404 })
    const { cookie, ctx: _ctx, ...identity } = await pageContext(pageId)
    const res = await foldersRequest("deliver", { ...identity, assetId }, cookie)
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location")
      if (!location || !/^https?:\/\//i.test(location)) throw new Error("External link unavailable")
      return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "private, no-store" } })
    }
    return new Response(res.body, { headers: {
      "Content-Type": res.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": res.headers.get("content-disposition") || "attachment",
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } })
  } catch {
    return new Response("This attachment is unavailable. Its owner may have moved it to Trash or its expiration date has passed.", { status: 404, headers: { "Cache-Control": "private, no-store" } })
  }
}

export const GET=wrapAdmission(GETHandler,'src/app/api/folders/assets/[assetId]/route.ts'+':GET',12000);
