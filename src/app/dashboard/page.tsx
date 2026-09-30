import Link from "next/link"
import { requireContext } from "@/lib/context"
import { listSpaces, recentPages } from "@/lib/nexus/data"
import { createSpace } from "@/lib/nexus/actions"
import { SpaceActions } from "@/components/nexus/space-actions"
import { PageHeader } from "@/components/ui"

export default async function Home() {
  const ctx = await requireContext()
  const canWrite = ["owner", "admin", "manager", "member"].includes(ctx.role)
  const canDelete = ["owner", "admin", "manager"].includes(ctx.role)
  const [spaces, recent] = await Promise.all([listSpaces(ctx.tenant.id), recentPages(ctx.tenant.id)])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-12">
      <PageHeader title={`${ctx.tenant.name} knowledge`} description="Spaces hold your team's docs, wikis and handbooks. Press ⌘K to search everything." />

      {canWrite && <form action={createSpace} className="card mb-10 flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted">Icon</span>
          <input name="icon" defaultValue="📘" maxLength={4} className="input w-16 text-center text-lg" aria-label="Space icon" />
        </label>
        <label className="grid flex-1 gap-1.5 text-sm">
          <span className="text-muted">New space</span>
          <input name="name" required maxLength={80} placeholder="Team handbook, Venue ops, Engineering…" className="input" />
        </label>
        <button className="btn-primary">Create space</button>
      </form>}

      <h2 className="mb-3 text-sm font-medium text-muted">Spaces</h2>
      {spaces.length === 0 ? (
        <p className="card mb-10 p-8 text-center text-sm text-muted">{canWrite ? "No spaces yet — create your first one above." : "No spaces are available in this workspace yet."}</p>
      ) : (
        <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((sp) => (
            <SpaceActions key={sp.id} space={sp} card canWrite={canWrite} canDelete={canDelete} />
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-medium text-muted">Recently edited</h2>
          <div className="card divide-y divide-line/60">
            {recent.map((p) => (
              <Link key={p.id} href={`/dashboard/s/${p.spaceId}/${p.id}`} className="flex items-center gap-3 p-4 text-sm hover:bg-panel-2">
                <span>{p.icon ?? "📄"}</span>
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                <span className="hidden text-xs text-muted sm:inline">{p.space}</span>
                <span className="text-xs text-muted">{p.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
