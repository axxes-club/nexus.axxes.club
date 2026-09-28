"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import type { TreePage } from "@/lib/nexus/types"
import { createPage, deletePage, movePage, renamePage } from "@/lib/nexus/actions"

type Menu = { x: number; y: number; page: TreePage } | null

export function PageTree({ spaceId, spaceName, spaceIcon, pages: serverPages }: { spaceId: string; spaceName: string; spaceIcon: string; pages: TreePage[] }) {
  // Optimistic edits shown immediately; the refreshed server tree replaces them
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [renamed, setRenamed] = useState<Record<string, string>>({})
  const pages = useMemo(
    () => serverPages.filter((p) => !hidden.has(p.id)).map((p) => (renamed[p.id] ? { ...p, title: renamed[p.id] } : p)),
    [serverPages, hidden, renamed]
  )
  const router = useRouter()
  const params = useParams<{ pageId?: string }>()
  const current = params.pageId
  const [pending, start] = useTransition()
  const [menu, setMenu] = useState<Menu>(null)
  const [moveOpen, setMoveOpen] = useState(false)

  const children = useMemo(() => {
    const m = new Map<string | null, TreePage[]>()
    for (const p of pages) m.set(p.parentId, [...(m.get(p.parentId) ?? []), p])
    for (const list of m.values()) list.sort((a, b) => a.position - b.position)
    return m
  }, [pages])

  // Pages on the path to the current page start expanded
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    if (!current) return
    const byId = new Map(pages.map((p) => [p.id, p]))
    const next = new Set(open)
    let cursor = byId.get(current)?.parentId ?? null
    while (cursor) {
      next.add(cursor)
      cursor = byId.get(cursor)?.parentId ?? null
    }
    setOpen(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, pages])

  useEffect(() => {
    if (!menu) return
    const close = () => { setMenu(null); setMoveOpen(false) }
    window.addEventListener("click", close)
    window.addEventListener("keydown", (e) => e.key === "Escape" && close(), { once: true })
    return () => window.removeEventListener("click", close)
  }, [menu])

  const newPage = (parentId: string | null) =>
    start(async () => {
      const { href } = await createPage(spaceId, parentId)
      if (parentId) setOpen((o) => new Set(o).add(parentId))
      router.push(href)
      router.refresh()
    })

  const Row = ({ page, depth }: { page: TreePage; depth: number }) => {
    const kids = children.get(page.id) ?? []
    const isOpen = open.has(page.id)
    return (
      <li>
        <div
          className={`group flex items-center gap-1 rounded-md pr-1 text-sm ${current === page.id ? "bg-panel-2 text-text" : "text-muted hover:bg-panel-2 hover:text-text"}`}
          style={{ paddingLeft: 4 + depth * 14 }}
          onContextMenu={(e) => { e.preventDefault(); setMoveOpen(false); setMenu({ x: e.clientX, y: e.clientY, page }) }}
          data-tree-page={page.title}
        >
          <button
            type="button"
            className={`grid size-5 shrink-0 place-items-center rounded text-[10px] ${kids.length ? "hover:bg-line" : "opacity-0"}`}
            onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(page.id)) n.delete(page.id); else n.add(page.id); return n })}
            aria-label={isOpen ? "Collapse" : "Expand"}
            tabIndex={kids.length ? 0 : -1}
          >
            {isOpen ? "▾" : "▸"}
          </button>
          <Link href={`/dashboard/s/${spaceId}/${page.id}`} className="min-w-0 flex-1 truncate py-1.5">
            <span className="mr-1.5">{page.icon ?? "📄"}</span>{page.title}
          </Link>
          <button type="button" onClick={() => newPage(page.id)} className="rounded px-1 opacity-0 hover:bg-line group-hover:opacity-100" aria-label={`New page inside ${page.title}`}>+</button>
        </div>
        {isOpen && kids.length > 0 && (
          <ul>{kids.map((k) => <Row key={k.id} page={k} depth={depth + 1} />)}</ul>
        )}
      </li>
    )
  }

  const roots = children.get(null) ?? []

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-panel/40 lg:h-dvh lg:sticky lg:top-0" aria-label="Pages">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href={`/dashboard/s/${spaceId}`} className="truncate font-semibold">{spaceIcon} {spaceName}</Link>
        {pending && <span className="text-xs text-muted">…</span>}
      </div>
      <ul className="flex-1 overflow-y-auto px-2 pb-4">
        {roots.map((p) => <Row key={p.id} page={p} depth={0} />)}
      </ul>
      <div className="border-t border-line p-2">
        <button type="button" onClick={() => newPage(null)} className="w-full rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-panel-2 hover:text-text">+ New page</button>
      </div>

      {menu && (
        <div role="menu" className="fixed z-50 min-w-52 rounded-lg border border-line bg-panel p-1 text-sm shadow-2xl" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          <MenuButton onClick={() => { setMenu(null); newPage(menu.page.id) }}>New page inside</MenuButton>
          <MenuButton onClick={() => { const id = menu.page.id; const t = prompt("Rename page", menu.page.title); setMenu(null); if (t) { setRenamed((r) => ({ ...r, [id]: t })); start(async () => { await renamePage(id, t); router.refresh() }) } }}>Rename</MenuButton>
          <MenuButton onClick={() => { navigator.clipboard.writeText(`[[${menu.page.title}]]`); setMenu(null) }}>Copy [[link]]</MenuButton>
          <MenuButton onClick={() => setMoveOpen((o) => !o)}>Move to… ›</MenuButton>
          {moveOpen && (
            <div className="ml-2 max-h-56 overflow-y-auto border-l border-line pl-1">
              <MenuButton onClick={() => { const id = menu.page.id; setMenu(null); start(async () => { await movePage(id, null); router.refresh() }) }}>Top level</MenuButton>
              {pages.filter((p) => p.id !== menu.page.id).map((p) => (
                <MenuButton key={p.id} onClick={() => {
                  const id = menu.page.id
                  setMenu(null)
                  start(async () => {
                    try { await movePage(id, p.id); setOpen((o) => new Set(o).add(p.id)); router.refresh() } catch (err) { alert(err instanceof Error ? err.message : "Couldn't move") }
                  })
                }}>{p.icon ?? "📄"} {p.title}</MenuButton>
              ))}
            </div>
          )}
          <div className="my-1 h-px bg-line" />
          <MenuButton danger onClick={() => {
            const pg = menu.page
            setMenu(null)
            if (!confirm(`Delete “${pg.title}” and any pages inside it?`)) return
            // Hide it and everything beneath it right away
            const gone = new Set([pg.id])
            for (let grew = true; grew; ) { grew = false; for (const p of serverPages) if (p.parentId && gone.has(p.parentId) && !gone.has(p.id)) { gone.add(p.id); grew = true } }
            setHidden((h) => new Set([...h, ...gone]))
            if (current && gone.has(current)) router.push(`/dashboard/s/${spaceId}`)
            start(async () => {
              await deletePage(pg.id)
              router.refresh()
            })
          }}>Delete</MenuButton>
        </div>
      )}
    </aside>
  )
}

function MenuButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-panel-2 ${danger ? "text-danger" : ""}`}>
      {children}
    </button>
  )
}
