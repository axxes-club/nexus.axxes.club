import { notFound } from "next/navigation"
import { requireContext } from "@/lib/context"
import { backlinks, findPageInOtherOrg, getPage, pageVersions, titleIndex } from "@/lib/nexus/data"
import { linkedTitles } from "@/lib/nexus/links"
import { Editor } from "@/components/nexus/editor"
import { WrongOrganization } from "@/components/nexus/wrong-organization"

export const dynamic = "force-dynamic"

export default async function PageView({ params }: { params: Promise<{ spaceId: string; pageId: string }> }) {
  const ctx = await requireContext()
  const { spaceId, pageId } = await params
  // Backlinks and version history are keyed by pageId, which is in the URL — so
  // they no longer wait behind getPage. Only the title index depends on the
  // page body, and it starts the moment the row lands.
  const [page, back, versions] = await Promise.all([
    getPage(ctx.tenant.id, pageId),
    backlinks(ctx.tenant.id, pageId),
    pageVersions(pageId),
  ])

  if (!page) {
    // The page is not in the organization this browser is looking at. Before
    // calling it missing, check the organizations this person does belong to:
    // a link into a sibling workspace is a routing mistake, not a dead end.
    const elsewhere = await findPageInOtherOrg(ctx.userId, pageId)
    if (elsewhere) {
      return (
        <WrongOrganization
          elsewhere={{ ...elsewhere, pageId }}
          currentName={ctx.tenant.name}
          returnTo={`/dashboard/s/${spaceId}/${pageId}`}
        />
      )
    }
    notFound()
  }
  if (page.spaceId !== spaceId) notFound()

  const index = await titleIndex(ctx.tenant.id, linkedTitles(page.content))
  const links = Object.fromEntries([...index].map(([t, p]) => [t, `/dashboard/s/${p.spaceId}/${p.id}`]))
  return (
    <Editor
      canWrite={["owner", "admin", "manager", "member"].includes(ctx.role)}
      key={page.id}
      page={page}
      links={links}
      backlinks={back}
      versions={versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() }))}
    />
  )
}
