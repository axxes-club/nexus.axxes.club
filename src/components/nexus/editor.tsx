"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { LinkT, PageT } from "@/lib/nexus/types"
import { renderWikiLinks } from "@/lib/nexus/links"
import { createPage, restoreVersion, savePage } from "@/lib/nexus/actions"

type Mode = "edit" | "split" | "preview"
type Version = { id: string; title: string; createdAt: string; author: string | null; size: number }
const SAVE_DELAY = 800
/** Autosave pauses arrive far faster than a round-trip completes. Anything saved
 *  inside this window is already covered by the refresh it is waiting on. */
const REFRESH_COALESCE_MS = 1500
const MODE_KEY = "nexus:mode"

export function Editor({ page, links, backlinks, versions }: { page: PageT; links: Record<string, string>; backlinks: LinkT[]; versions: Version[] }) {
  const router = useRouter()
  const [title, setTitle] = useState(page.title)
  const [content, setContent] = useState(page.content)
  const [icon, setIcon] = useState(page.icon)
  const [mode, setMode] = useState<Mode>("split")
  const [status, setStatus] = useState<"saved" | "dirty" | "saving">("saved")
  const [panel, setPanel] = useState<"links" | "history">("links")
  const [, start] = useTransition()
  const area = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshIn = useRef(false)
  // The autosave payload. Kept in a ref and written at the point of edit rather
  // than during render, so it always holds the newest text even when several
  // edits land inside one React batch.
  const latest = useRef({ title, content })

  useEffect(() => {
    try {
      const m = localStorage.getItem(MODE_KEY) as Mode | null
      if (m === "edit" || m === "split" || m === "preview") setMode(m)
      else if (!page.content) setMode("edit")
    } catch {}
  }, [page.content])

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setStatus("saving")
    await savePage(page.id, latest.current)
    setStatus("saved")
    // router.refresh() re-renders the whole server tree — the rail, the backlinks
    // panel, the version list. Autosave fires on every typing pause, so calling it
    // every time queued a full RSC round-trip behind the keyboard. Coalescing them
    // keeps the panel eventually correct without one request per sentence.
    if (refreshIn.current) return
    refreshIn.current = true
    router.refresh()
    setTimeout(() => { refreshIn.current = false }, REFRESH_COALESCE_MS)
  }, [page.id, router])

  const schedule = () => {
    setStatus("dirty")
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY)
  }

  // The one place content changes, so the autosave payload can never drift from
  // what is on screen.
  const edit = useCallback((next: string) => {
    latest.current = { ...latest.current, content: next }
    setContent(next)
    schedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush])

  // Save before leaving if something is pending
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (timer.current) { flush(); e.preventDefault() } }
    window.addEventListener("beforeunload", warn)
    return () => { window.removeEventListener("beforeunload", warn); if (timer.current) flush() }
  }, [flush])

  const setModeSaved = (m: Mode) => {
    setMode(m)
    try { localStorage.setItem(MODE_KEY, m) } catch {}
  }

  // Wrap the selection (or insert at the cursor) in the textarea
  const wrap = (before: string, after = before, placeholder = "") => {
    const el = area.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b, value } = el
    const selected = value.slice(a, b) || placeholder
    const next = value.slice(0, a) + before + selected + after + value.slice(b)
    edit(next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + before.length, a + before.length + selected.length) })
  }
  const linePrefix = (prefix: string) => {
    const el = area.current
    if (!el) return
    const { selectionStart: a, value } = el
    const lineStart = value.lastIndexOf("\n", a - 1) + 1
    edit(value.slice(0, lineStart) + prefix + value.slice(lineStart))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + prefix.length, a + prefix.length) })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key === "b") { e.preventDefault(); wrap("**", "**", "bold") }
    if (mod && e.key === "i") { e.preventDefault(); wrap("_", "_", "italic") }
    if (mod && e.key === "s") { e.preventDefault(); flush() }
    if (e.key === "Tab") { e.preventDefault(); wrap("  ", "") }
  }

  // Parsing markdown is the most expensive thing this component does, so the
  // preview renders from a value that lags typing by a tick. The textarea stays
  // instant; the preview catches up a frame later instead of blocking each
  // keystroke on a full ReactMarkdown parse of the whole page.
  const deferred = useDeferredValue(content)
  const rendered = useMemo(() => renderWikiLinks(deferred, (t) => links[t.toLowerCase()] ?? null), [deferred, links])

  const openLink = (href: string) => {
    if (!href.startsWith("#new:")) return false
    const t = decodeURIComponent(href.slice(5))
    start(async () => {
      await flush()
      const { href: dest } = await createPage(page.spaceId, page.id, t)
      router.push(dest)
    })
    return true
  }

  const tools: [string, () => void, string][] = [
    ["H1", () => linePrefix("# "), "Heading 1"],
    ["H2", () => linePrefix("## "), "Heading 2"],
    ["B", () => wrap("**", "**", "bold"), "Bold (⌘B)"],
    ["I", () => wrap("_", "_", "italic"), "Italic (⌘I)"],
    ["•", () => linePrefix("- "), "Bullet list"],
    ["☐", () => linePrefix("- [ ] "), "Checklist"],
    ["❝", () => linePrefix("> "), "Quote"],
    ["</>", () => wrap("`", "`", "code"), "Inline code"],
    ["🔗", () => wrap("[", "](https://)", "link text"), "Link"],
    ["[[ ]]", () => wrap("[[", "]]", "Page title"), "Link to a page"],
  ]

  return (
    <div className="flex min-h-dvh">
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur">
          {tools.map(([label, fn, hint]) => (
            <button key={hint} type="button" onClick={fn} title={hint} aria-label={hint} className="rounded-md px-2 py-1 font-mono text-xs text-muted hover:bg-panel-2 hover:text-text">{label}</button>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-muted" aria-live="polite">{status === "saved" ? "Saved" : status === "saving" ? "Saving…" : "Editing…"}</span>
            <div className="flex rounded-lg border border-line p-0.5 text-xs">
              {(["edit", "split", "preview"] as Mode[]).map((m) => (
                <button key={m} type="button" onClick={() => setModeSaved(m)} className={`rounded-md px-2.5 py-1 capitalize ${mode === m ? "bg-accent text-accent-ink" : "text-muted hover:text-text"}`}>{m}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
          <div className="flex items-start gap-3">
            <button type="button" className="mt-1 text-4xl" title="Change icon" aria-label="Change icon"
              onClick={() => { const v = prompt("Emoji icon for this page", icon ?? ""); if (v !== null) { setIcon(v || null); start(async () => { await savePage(page.id, { icon: v || null }); router.refresh() }) } }}>
              {icon ?? "📄"}
            </button>
            <input
              value={title}
              onChange={(e) => { const v = e.target.value; latest.current = { ...latest.current, title: v }; setTitle(v); schedule() }}
              placeholder="Untitled"
              className="min-w-0 flex-1 bg-transparent text-4xl font-semibold tracking-tight outline-none placeholder:text-muted/50"
              aria-label="Page title"
            />
          </div>
          <p className="mt-2 text-xs text-muted">Last edited {new Date(page.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}{page.updatedBy ? ` by ${page.updatedBy}` : ""}</p>

          <div className={`mt-8 grid gap-8 ${mode === "split" ? "lg:grid-cols-2" : ""}`}>
            {mode !== "preview" && (
              <textarea
                ref={area}
                value={content}
                onChange={(e) => edit(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={"Start writing… Markdown works: # headings, - lists, - [ ] tasks, **bold**, [[Page links]]"}
                className="min-h-[60vh] w-full resize-none rounded-xl border border-line bg-panel/60 p-5 font-mono text-[14px] leading-relaxed outline-none focus:border-accent/60"
                aria-label="Page content"
                spellCheck
              />
            )}
            {mode !== "edit" && (
              <article className="nexus-prose min-w-0" data-preview>
                {content.trim() ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href = "", children }) => {
                        if (href.startsWith("#new:")) return <a href={href} className="text-accent/60 underline decoration-dashed" title="Create this page" onClick={(e) => { e.preventDefault(); openLink(href) }}>{children}</a>
                        if (href.startsWith("/")) return <Link href={href} className="text-accent underline-offset-2 hover:underline">{children}</Link>
                        return <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">{children}</a>
                      },
                    }}
                  >
                    {rendered}
                  </ReactMarkdown>
                ) : (
                  <p className="text-muted">Nothing here yet.</p>
                )}
              </article>
            )}
          </div>
        </div>
      </div>

      <aside className="hidden w-72 shrink-0 border-l border-line xl:block" aria-label="Page details">
        <div className="sticky top-0 p-5">
          <div className="mb-4 flex gap-4 text-xs font-medium uppercase tracking-wider">
            <button type="button" className={panel === "links" ? "text-text" : "text-muted"} onClick={() => setPanel("links")}>Backlinks ({backlinks.length})</button>
            <button type="button" className={panel === "history" ? "text-text" : "text-muted"} onClick={() => setPanel("history")}>History ({versions.length})</button>
          </div>
          {panel === "links" ? (
            backlinks.length ? (
              <ul className="space-y-1 text-sm">
                {backlinks.map((b) => (
                  <li key={b.id}><Link href={`/dashboard/s/${b.spaceId}/${b.id}`} className="block truncate rounded-md px-2 py-1.5 text-muted hover:bg-panel-2 hover:text-text">{b.icon ?? "📄"} {b.title}</Link></li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No pages link here yet. Link to it with <code className="font-mono text-text">[[{title}]]</code>.</p>
            )
          ) : versions.length ? (
            <ul className="space-y-2 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="rounded-lg border border-line p-2.5">
                  <p className="truncate font-medium">{v.title}</p>
                  <p className="text-xs text-muted">{new Date(v.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · {v.author ?? "someone"} · {v.size.toLocaleString()} chars</p>
                  <button type="button" className="mt-1.5 text-xs text-accent hover:underline"
                    onClick={() => confirm("Restore this version? The current text is saved to history first.") && start(async () => { await restoreVersion(page.id, v.id); router.refresh(); location.reload() })}>
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Versions appear here as the page changes.</p>
          )}
        </div>
      </aside>
    </div>
  )
}
