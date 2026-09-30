import { notFound } from "next/navigation"
import { requireContext } from "@/lib/context"
import { findSpaceInOtherOrg, getSpace, spaceTree } from "@/lib/nexus/data"
import { PageTree } from "@/components/nexus/page-tree"
import { WrongOrganization } from "@/components/nexus/wrong-organization"

export default async function SpaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ spaceId: string }> }) {
  const ctx = await requireContext()
  const { spaceId } = await params
  // The tree is keyed by spaceId, which we already have, so it does not have to
  // wait on the space lookup. Running them together halves the time to first byte.
  const [space, pages] = await Promise.all([getSpace(ctx.tenant.id, spaceId), spaceTree(spaceId)])
  if (!space) {
    // Same reasoning as a missing page: a space in a workspace this person
    // belongs to but is not looking at is a wrong turn, not a dead end.
    const elsewhere = await findSpaceInOtherOrg(ctx.userId, spaceId)
    if (elsewhere) {
      return <WrongOrganization elsewhere={elsewhere} currentName={ctx.tenant.name} returnTo={`/dashboard/s/${spaceId}`} />
    }
    notFound()
  }
  return (
    <div className="flex">
      <PageTree spaceId={space.id} spaceName={space.name} spaceIcon={space.icon} spaceDescription={space.description} pages={pages} canWrite={["owner", "admin", "manager", "member"].includes(ctx.role)} canDelete={["owner", "admin", "manager"].includes(ctx.role)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
