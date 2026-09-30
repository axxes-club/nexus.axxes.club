import { openInOrganization } from "@/lib/actions/org"

export type Elsewhere = {
  tenantId: string
  tenantName: string
  spaceId: string
  spaceName: string
  spaceIcon: string | null
  pageId?: string
  pageTitle?: string
}

/**
 * "That page is in another organization you belong to."
 *
 * Nexus reads one organization at a time, chosen per browser. Follow a link to
 * a page in a workspace you are not currently in and every query is correctly
 * scoped away from it, so the page looks deleted. It is not: it is one click
 * away, and the person almost certainly did not mean to end up here.
 *
 * So say that, name the workspace, and offer the switch — rather than a bare
 * 404, which sends people to the dashboard to hunt for something sitting in
 * the sidebar of a different workspace.
 */
export function WrongOrganization({
  elsewhere,
  currentName,
  returnTo,
}: {
  elsewhere: Elsewhere
  currentName: string
  returnTo: string
}) {
  const isPage = Boolean(elsewhere.pageId && elsewhere.pageTitle)
  const headline = isPage
    ? `“${elsewhere.pageTitle}” is in another organization`
    : `${elsewhere.spaceName} is in another organization`
  const sub = isPage
    ? `It lives in ${elsewhere.tenantName} › ${elsewhere.spaceName}.`
    : `It lives in ${elsewhere.tenantName}.`

  return (
    <div className="grid min-h-[60vh] place-items-center px-6 py-16">
      <div className="w-full max-w-md">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {elsewhere.spaceIcon ?? "📘"} {elsewhere.spaceName}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{headline}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{sub}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          You are looking at <span className="text-text">{currentName}</span>. Nexus shows one
          organization at a time, so this stays hidden until you switch.
        </p>

        <form action={openInOrganization.bind(null, elsewhere.tenantId, returnTo)} className="mt-7">
          <button type="submit" className="btn-primary">
            Open in {elsewhere.tenantName}
          </button>
        </form>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          You can switch organization any time from the button at the bottom of the sidebar.
        </p>
      </div>
    </div>
  )
}
