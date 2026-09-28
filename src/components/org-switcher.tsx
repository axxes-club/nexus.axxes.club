"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { switchOrganization } from "@/lib/actions/org"
import type { Membership } from "@/lib/context"

// Inline rather than lucide-react: this app does not depend on it, and adding
// an icon library for two glyphs is not a trade worth making.
function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronsUpDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M4 6l4-4 4 4M4 10l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Switching organization.
 *
 * Only rendered when there is a real choice. A person in one organization does
 * not need to be told which organization they are in, and a switcher they
 * cannot use is just furniture.
 *
 * The switch is a full navigation rather than a client-side push: the
 * organization decides what data the page can see, and every server component
 * has to see the new one.
 */
export function OrgSwitcher({
  current,
  memberships,
}: {
  current: Membership
  memberships: Membership[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  if (memberships.length < 2) {
    return (
      <div className="rounded-lg border border-line px-2.5 py-1.5">
        <p className="truncate font-medium text-text">{current.name}</p>
        <p className="truncate text-muted">Your organization</p>
      </div>
    )
  }

  function choose(tenantId: string) {
    setOpen(false)
    if (tenantId === current.tenantId) return
    startTransition(async () => {
      await switchOrganization(tenantId)
      router.refresh()
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={pending}
        className="flex w-full items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-left transition hover:bg-panel-2 disabled:opacity-60"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-text">{current.name}</span>
          <span className="block truncate text-[10px] capitalize text-muted">
            {pending ? "Switching…" : current.role.replace("_", " ")}
          </span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <ul
            role="listbox"
            aria-label="Switch organization"
            className="absolute bottom-full left-0 z-20 mb-1 w-full overflow-hidden rounded-lg border border-line bg-panel shadow-lg"
          >
            {memberships.map((m) => {
              const active = m.tenantId === current.tenantId
              return (
                <li key={m.tenantId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => choose(m.tenantId)}
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition hover:bg-panel-2"
                  >
                    <Check
                      className={`h-3.5 w-3.5 shrink-0 ${active ? "text-accent" : "opacity-0"}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-text">{m.name}</span>
                      <span className="block truncate text-[10px] capitalize text-muted">
                        {m.role.replace("_", " ")}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
