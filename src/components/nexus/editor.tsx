"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { LinkT, PageT } from "@/lib/nexus/types"
import { renderWikiLinks } from "@/lib/nexus/links"
import { createPage, restoreVersion, savePage } from "@/lib/nexus/actions"
import { AssetPicker, type AssetPickerHandle } from "./asset-picker"
import { attachmentMarkdown, insertAttachments, type InsertionPoint } from "@/lib/folders/markdown"
import type { FolderAsset } from "@/lib/folders/types"
import { ManagementDialog } from "./management-ui"

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
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [iconDialog, setIconDialog] = useState(false)
  const [iconPending, setIconPending] = useState(false)
  const [iconError, setIconError] = useState<string | null>(null)
  const [panel, setPanel] = useState<"links" | "history">("links")
  const [, start] = useTransition()
  const area = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<AssetPickerHandle>(null)
  const insertion = useRef<InsertionPoint>({ content: page.content, start: page.content.length, end: page.content.length })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshIn = useRef(false)
  // The autosave payload. Kept in a ref and written at the point of edit rather
  // than during render, so it always holds the newest text even when several
  // edits land inside one React batch.
  const latest = useRef({ title, content })
  const previousServer = useRef({ title: page.title, content: page.content })
  useEffect(() => {
    if (latest.current.title === previousServer.current.title && page.title !== previousServer.current.title) { latest.current = { ...latest.current, title: page.title }; setTitle(page.title) }
    if (latest.current.content === previousServer.current.content && page.content !== previousServer.current.content) { latest.current = { ...latest.current, content: page.content }; setContent(page.content) }
    previousServer.current = { title: page.title, content: page.content }
  }, [page.title, page.content])
  useEffect(() => setIcon(page.icon), [page.icon])

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
    const submitted = latest.current
    try {
      await savePage(page.id, submitted)
      setSaveError(null)
      setStatus(latest.current === submitted ? "saved" : "dirty")
    } catch (error) {
      setStatus("error")
      setSaveError(error instanceof Error ? error.message : "Your changes could not be saved. Retry to keep them.")
      return false
    }
    // router.refresh() re-renders the whole server tree — the rail, the backlinks
    // panel, the version list. Autosave fires on every typing pause, so calling it
    // every time queued a full RSC round-trip behind the keyboard. Coalescing them
    // keeps the panel eventually correct without one request per sentence.
    if (refreshIn.current) return true
    refreshIn.current = true
    router.refresh()
    setTimeout(() => { refreshIn.current = false }, REFRESH_COALESCE_MS)
    return true
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
  const openAssets = (files: File[] = []) => {
    insertion.current = { content: latest.current.content, start: area.current?.selectionStart ?? latest.current.content.length, end: area.current?.selectionEnd ?? latest.current.content.length }
    picker.current?.open(files)
  }
  const insertAssets = (assets: FolderAsset[]) => {
    const markdown = assets.map(asset => attachmentMarkdown(asset, page.id)).join("\n\n")
    const result = insertAttachments(latest.current.content, insertion.current, markdown)
    edit(result.content)
    insertion.current = { content: result.content, start: result.cursor, end: result.cursor }
    requestAnimationFrame(() => area.current?.setSelectionRange(result.cursor, result.cursor))
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
      if (!await flush()) return
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
    <div className="flex min-h-dvh" onDragOver={e => { if (e.dataTransfer.types.includes("Files")) e.preventDefault() }} onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); openAssets(Array.from(e.dataTransfer.files)) } }}>
      <AssetPicker ref={picker} pageId={page.id} onInsert={insertAssets} />
      {iconDialog && <ManagementDialog title="Change page icon" close={() => setIconDialog(false)} pending={iconPending} error={iconError} submit={async form => {
        const value = String(form.get("icon") || "").trim()
        setIconPending(true); setIconError(null)
        try { await savePage(page.id, { icon: value || null }); setIcon(value || null); setIconDialog(false); router.refresh() } catch (e) { setIconError(e instanceof Error ? e.message : "Could not update icon") } finally { setIconPending(false) }
      }}><label className="grid gap-2 text-sm">Emoji or symbol<input name="icon" defaultValue={icon || ""} maxLength={16} className="input text-2xl" autoFocus /></label></ManagementDialog>}
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur">
          {tools.map(([label, fn, hint]) => (
            <button key={hint} type="button" onClick={fn} title={hint} aria-label={hint} className="rounded-md px-2 py-1 font-mono text-xs text-muted hover:bg-panel-2 hover:text-text">{label}</button>
          ))}
          <button type="button" onClick={() => openAssets()} className="btn-ghost min-h-9 px-3 py-1 text-xs" title="Upload files and images, or choose from Folders">📎 Add files</button>
          <div className="ml-auto flex items-center gap-3">
            <span className={`text-xs ${status === "error" ? "text-danger" : "text-muted"}`} aria-live="polite">{status === "saved" ? "Saved" : status === "saving" ? "Saving…" : status === "error" ? "Not saved" : "Editing…"}</span>
            <div className="flex rounded-lg border border-line p-0.5 text-xs">
              {(["edit", "split", "preview"] as Mode[]).map((m) => (
                <button key={m} type="button" onClick={() => setModeSaved(m)} className={`rounded-md px-2.5 py-1 capitalize ${mode === m ? "bg-accent text-accent-ink" : "text-muted hover:text-text"}`}>{m}</button>
              ))}
            </div>
          </div>
        </div>
        {saveError && <div role="alert" className="flex items-center justify-between gap-3 border-b border-danger/30 bg-danger/5 px-4 py-3 text-sm"><span>{saveError}</span><button type="button" className="btn-ghost" onClick={() => flush()}>Retry save</button></div>}

        <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
          <div className="flex items-start gap-3">
            <button type="button" className="mt-1 text-4xl" title="Change icon" aria-label="Change icon"
              onClick={() => { setIconError(null); setIconDialog(true) }}>
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
                onPaste={e => { const images = Array.from(e.clipboardData.files).filter(f => f.type.startsWith("image/")); if (images.length) { e.preventDefault(); openAssets(images) } }}
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
                        if (href.startsWith("/api/folders/assets/")) return <a href={href} download className="inline-flex items-center gap-1 rounded-lg border border-line bg-panel px-3 py-1 text-accent hover:bg-panel-2">📎 {children}</a>
                        if (href.startsWith("#new:")) return <a href={href} className="text-accent/60 underline decoration-dashed" title="Create this page" onClick={(e) => { e.preventDefault(); openLink(href) }}>{children}</a>
                        if (href.startsWith("/")) return <Link href={href} className="text-accent underline-offset-2 hover:underline">{children}</Link>
                        return <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">{children}</a>
                      },
                      img: ({ src, alt }) => typeof src === "string" && src.startsWith("/api/folders/assets/") ? <FolderImage src={src} alt={alt || "Attached image"} /> : <img src={src} alt={alt || ""} loading="lazy" />,
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

function FolderImage({ src, alt }: { src: string; alt: string }) {
  const [unavailable, setUnavailable] = useState(false)
  if (unavailable) return <span className="my-3 block rounded-xl border border-line bg-panel p-4 text-sm text-muted">▧ {alt}<span className="mt-1 block text-xs">This image is unavailable. Its owner may have deleted it or its expiration date has passed.</span><button type="button" onClick={() => setUnavailable(false)} className="mt-2 text-accent">Try again</button></span>
  return <img src={src} alt={alt} loading="lazy" onError={() => setUnavailable(true)} />
}
