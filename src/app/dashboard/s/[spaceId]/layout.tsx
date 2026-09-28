import { notFound } from "next/navigation"
import { requireContext } from "@/lib/context"
import { getSpace, spaceTree } from "@/lib/nexus/data"
import { PageTree } from "@/components/nexus/page-tree"

export default async function SpaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ spaceId: string }> }) {
  const ctx = await requireContext()
  const { spaceId } = await params
  const space = await getSpace(ctx.tenant.id, spaceId)
  if (!space) notFound()
  const pages = await spaceTree(space.id)
  return (
    <div className="flex">
      <PageTree spaceId={space.id} spaceName={space.name} spaceIcon={space.icon} pages={pages} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
