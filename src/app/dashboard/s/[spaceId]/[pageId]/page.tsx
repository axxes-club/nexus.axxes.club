import { notFound } from "next/navigation"
import { requireContext } from "@/lib/context"
import { backlinks, getPage, pageVersions, titleIndex } from "@/lib/nexus/data"
import { linkedTitles } from "@/lib/nexus/links"
import { Editor } from "@/components/nexus/editor"

export const dynamic = "force-dynamic"

export default async function PageView({ params }: { params: Promise<{ spaceId: string; pageId: string }> }) {
  const ctx = await requireContext()
  const { spaceId, pageId } = await params
  const page = await getPage(ctx.tenant.id, pageId)
  if (!page || page.spaceId !== spaceId) notFound()

  const [index, back, versions] = await Promise.all([titleIndex(ctx.tenant.id, linkedTitles(page.content)), backlinks(ctx.tenant.id, page.id), pageVersions(page.id)])
  const links = Object.fromEntries([...index].map(([t, p]) => [t, `/dashboard/s/${p.spaceId}/${p.id}`]))
  return (
    <Editor
      key={page.id}
      page={page}
      links={links}
      backlinks={back}
      versions={versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() }))}
    />
  )
}
