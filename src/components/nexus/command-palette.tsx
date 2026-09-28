"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { search } from "@/lib/nexus/actions"

type Hit = Awaited<ReturnType<typeof search>>[number]

// ⌘K / Ctrl+K: search every page in the workspace
export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<Hit[]>([])
  const [active, setActive] = useState(0)
  const seq = useRef(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    const n = ++seq.current
    const t = setTimeout(async () => {
      const r = q.trim().length >= 2 ? await search(q) : []
      if (n === seq.current) {
        setHits(r)
        setActive(0)
      }
    }, 150)
    return () => clearTimeout(t)
  }, [q, open])

  if (!open) return null
  const go = (h: Hit) => {
    setOpen(false)
    setQ("")
    router.push(`/dashboard/s/${h.spaceId}/${h.id}`)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/60 px-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)} role="dialog" aria-label="Search">
      <div className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)) }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
            if (e.key === "Enter" && hits[active]) go(hits[active])
          }}
          placeholder="Search pages…"
          className="w-full border-b border-line bg-transparent px-5 py-4 text-lg outline-none"
          aria-label="Search pages"
        />
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {hits.map((h, i) => (
            <li key={h.id}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(h)} className={`w-full rounded-lg px-3 py-2.5 text-left ${i === active ? "bg-panel-2" : ""}`}>
                <p className="text-sm font-medium">{h.icon ?? "📄"} {h.title} <span className="ml-2 text-xs font-normal text-muted">{h.space}</span></p>
                {h.snippet && <p className="mt-0.5 truncate text-xs text-muted">{h.snippet.replace(/[#*_`>\[\]]/g, "")}</p>}
              </button>
            </li>
          ))}
          {q.trim().length >= 2 && hits.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No pages match “{q}”.</li>}
          {q.trim().length < 2 && <li className="px-3 py-6 text-center text-sm text-muted">Type to search titles and content.</li>}
        </ul>
      </div>
    </div>
  )
}
