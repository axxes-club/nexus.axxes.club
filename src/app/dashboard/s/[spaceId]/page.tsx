import { redirect } from "next/navigation"
import { requireContext } from "@/lib/context"
import { spaceTree } from "@/lib/nexus/data"

// A space opens on its first top-level page
export default async function SpaceIndex({ params }: { params: Promise<{ spaceId: string }> }) {
  await requireContext()
  const { spaceId } = await params
  const pages = await spaceTree(spaceId)
  const first = pages.find((p) => !p.parentId) ?? pages[0]
  if (first) redirect(`/dashboard/s/${spaceId}/${first.id}`)
  return <p className="p-10 text-muted">This space is empty. Use “New page” in the sidebar to start.</p>
}
