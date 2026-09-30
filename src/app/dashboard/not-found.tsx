import Link from "next/link"

/**
 * A page that genuinely does not exist, in any organization this person
 * belongs to. The workspace route has already checked the sibling
 * organizations and offered a switch; reaching here means the id is wrong or
 * the page is really gone, so say what to try next rather than leaving a bare
 * 404 in the middle of the app.
 */
export default function DashboardNotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This page isn&apos;t in any of your organizations. It may have been deleted, or the link
          may be from a different workspace.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-4">
          <Link className="btn-primary" href="/dashboard">
            Go to your dashboard
          </Link>
          <p className="text-xs text-muted">
            or press <kbd className="font-mono">⌘K</kbd> to search everything you can see
          </p>
        </div>
      </div>
    </div>
  )
}
