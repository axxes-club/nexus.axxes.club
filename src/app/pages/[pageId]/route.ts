import { notFound, redirect } from "next/navigation"
import { requireContext } from "@/lib/context"
import { findPageInOtherOrg, getPage } from "@/lib/nexus/data"
export async function GET(_request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const ctx = await requireContext()
  const { pageId } = await params
  const page = await getPage(ctx.tenant.id, pageId)
  if (page) redirect(`/dashboard/s/${page.spaceId}/${page.id}`)
  const elsewhere = await findPageInOtherOrg(ctx.userId, pageId)
  if (elsewhere) redirect(`/dashboard/s/${elsewhere.spaceId}/${pageId}`)
  notFound()
}
