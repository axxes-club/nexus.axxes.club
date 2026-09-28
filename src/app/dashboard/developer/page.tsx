import { headers } from "next/headers"
import { requireContext } from "@/lib/context"
import { PageHeader } from "@/components/ui"
import { TokenManager } from "@/components/developer/token-manager"
import { PromptLibrary } from "@/components/developer/prompt-library"
import { buildPrompts, IMPORT_SHAPE } from "@/lib/developer/import-prompts"

export const metadata = { title: "Developer — Nexus" }
export const dynamic = "force-dynamic"

const ROLE_RANK: Record<string, number> = { owner: 4, admin: 3, manager: 2, member: 1, viewer: 0 }

const ROLE_MEANING: Record<string, string> = {
  owner: "Everything, including billing and deleting the workspace.",
  admin: "Everything except billing.",
  manager: "Create and edit content, manage members.",
  member: "Create and edit your own content.",
  viewer: "Read only.",
}

export default async function DeveloperPage() {
  const ctx = await requireContext()
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const origin = `${proto}://${host}`

  const prompts = buildPrompts({ orgName: ctx.tenant.name, orgSlug: ctx.tenant.slug })
  const rank = ROLE_RANK[ctx.role] ?? 0

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <PageHeader
        title="Developer"
        description="Connect Nexus to your own tools, and bring content in from somewhere else."
      />

      {/* --- Organization & role ------------------------------------- */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-text">This workspace</h2>
        <dl className="mt-3 divide-y divide-line rounded-xl border border-line">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-muted">Organization</dt>
            <dd className="text-sm font-medium text-text">{ctx.tenant.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-muted">Workspace</dt>
            <dd className="font-mono text-xs text-text">{ctx.tenant.slug}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-muted">Your role</dt>
            <dd className="text-sm font-medium capitalize text-text">{ctx.role}</dd>
          </div>
          <div className="px-4 py-3">
            <dt className="text-sm text-muted">What that allows</dt>
            <dd className="mt-1 text-sm text-text">{ROLE_MEANING[ctx.role] ?? "Ask an owner what your role includes."}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted">
          Organization and role come from your AXXES account, the same place every other AXXES
          product reads them from. Change it there and it changes here.
        </p>
        {rank < 2 && (
          <p className="mt-3 rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs text-muted">
            Your role is read-only on content, so new tokens will inherit that. Ask an owner if you
            need write access.
          </p>
        )}
      </section>

      {/* --- API tokens ---------------------------------------------- */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold text-text">API tokens</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          For scripts, integrations and anything that is not a person clicking around. A token acts
          as you, in this workspace, with your role.
        </p>
        <TokenManager origin={origin} />
      </section>

      {/* --- AI import ----------------------------------------------- */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold text-text">Import with AI</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Paste one of these into your AI tool, point it at the thing you want moved, and it returns
          content in the exact shape Nexus accepts. No reshaping afterwards.
        </p>
        <PromptLibrary prompts={prompts} />
        <p className="mt-4 text-xs text-muted">
          Every prompt asks for the same envelope:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-panel-2 p-3 font-mono text-[11px] text-muted">
          {IMPORT_SHAPE}
        </pre>
      </section>
    </div>
  )
}
