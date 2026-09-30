"use client"
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { genUploader } from "uploadthing/client"
import type { AppFileRouter } from "@/app/api/uploadthing/core"
import type { Destination, FolderAsset } from "@/lib/folders/types"

const uploader = genUploader<AppFileRouter>()
export async function assetApi<T>(action: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/folders/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || "Folders is unavailable")
  return result
}
export type AssetPickerHandle = { open: (files?: File[]) => void }
type Handoff = { intentId: string; url: string; qr: string; expiresAt: string; libraryId: string; folder: string }
export const AssetPicker = forwardRef<AssetPickerHandle, { pageId: string; onInsert: (assets: FolderAsset[]) => void }>(({ pageId, onInsert }, ref) => {
  const [open, setOpen] = useState(false)
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [selected, setSelected] = useState("personal")
  const [folder, setFolder] = useState("/Apps/Nexus")
  const [expiresAt, setExpiresAt] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [assets, setAssets] = useState<FolderAsset[]>([])
  const [tab, setTab] = useState<"upload" | "existing">("upload")
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [handoff, setHandoff] = useState<Handoff | null>(null)
  const [loading, setLoading] = useState(false)
  const [foldersUrl, setFoldersUrl] = useState("https://dam.axxes.club")
  const dialog = useRef<HTMLDialogElement>(null)
  const preference = useRef<string | null>(null)
  const cancel = useRef<AbortController | null>(null)
  const inserted = useRef(new Set<string>())
  const insert = useRef(onInsert)
  insert.current = onInsert
  const destination = destinations.find(d => (d.folder ? `${d.id}:${d.folder}` : d.id) === selected)
  const libraryId = destination?.id || "personal"
  const options = () => ({ pageId, libraryId, folder: destination?.folder || folder, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null })
  const accept = (rows: FolderAsset[]) => {
    const fresh = rows.filter(row => !inserted.current.has(row.id))
    if (!fresh.length) return
    fresh.forEach(row => inserted.current.add(row.id))
    insert.current(fresh)
    setNotice(`Added ${fresh.length} ${fresh.length === 1 ? "attachment" : "attachments"} to this page. Your assets are available in Folders.`)
  }
  useImperativeHandle(ref, () => ({ open: (newFiles = []) => { setFiles(newFiles); setTab("upload"); setError(null); setNotice(null); setOpen(true) } }), [])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    const controller = new AbortController()
    setLoading(true)
    assetApi<{ destinations: Destination[]; preferenceKey: string; foldersUrl: string }>("destinations", { pageId }, controller.signal)
      .then(data => {
        setDestinations(data.destinations); setFoldersUrl(data.foldersUrl); preference.current = data.preferenceKey
        try {
          const saved = JSON.parse(localStorage.getItem(data.preferenceKey) || "null")
          if (saved && data.destinations.some(d => (d.folder ? `${d.id}:${d.folder}` : d.id) === saved.selected)) { setSelected(saved.selected); setFolder(saved.folder || "/Apps/Nexus") }
        } catch {}
      }).catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); previous?.focus() }
  }, [open, pageId])
  useEffect(() => {
    if (!open || !preference.current) return
    try { localStorage.setItem(preference.current, JSON.stringify({ selected, folder })) } catch {}
  }, [selected, folder, open])
  useEffect(() => { if (open && destination?.canWrite === false) setTab("existing") }, [open, destination?.canWrite])
  useEffect(() => {
    if (!open || tab !== "existing" || !destinations.length) return
    const controller = new AbortController()
    setLoading(true); setAssets([])
    assetApi<{ assets: FolderAsset[] }>("assets", { pageId, libraryId, folder: destination?.folder || undefined }, controller.signal)
      .then(data => setAssets(data.assets)).catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [tab, open, pageId, libraryId, destination?.folder, destinations.length])
  useEffect(() => {
    if (!handoff || !open) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const result = await assetApi<{ assets: FolderAsset[] }>("uploads", { pageId, intentId: handoff.intentId }, controller.signal)
        if (!controller.signal.aborted) accept(result.assets)
      } catch (e) { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : "Phone upload unavailable"); return } }
      if (!controller.signal.aborted) timer = setTimeout(poll, 3000)
    }
    timer = setTimeout(poll, 1500)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [handoff, open, pageId])
  useEffect(() => () => cancel.current?.abort(), [])
  const upload = async () => {
    if (!files.length || busy) return
    setBusy(true); setError(null); setProgress(0)
    const controller = new AbortController(); cancel.current = controller
    let intentId: string | undefined
    try {
      const prepared = await assetApi<{ intentId: string }>("authorize", options(), controller.signal)
      intentId = prepared.intentId
      const response = await uploader.uploadFiles("nexusAssets", { files, input: { ...options(), intentId }, signal: controller.signal, onUploadProgress: p => setProgress(p.totalProgress) })
      accept(response.map(r => ({ ...r.serverData, folder, size: r.size, expiresAt: null })))
      setFiles([])
    } catch (e) {
      if (intentId) {
        const completed = await assetApi<{ assets: FolderAsset[] }>("uploads", { pageId, intentId }).catch(() => null)
        if (completed) { accept(completed.assets); const done = new Set(completed.assets.map(a => a.name)); setFiles(current => current.filter(f => !done.has(f.name))) }
      }
      setError(controller.signal.aborted ? "Upload canceled. Completed files remain in Folders." : e instanceof Error ? e.message : "Upload failed. You can retry.")
    } finally { setBusy(false); cancel.current = null }
  }
  const attach = async (asset: FolderAsset) => {
    setBusy(true); setError(null)
    try { accept([await assetApi<FolderAsset>("attach", { pageId, assetId: asset.id })]) } catch (e) { setError(e instanceof Error ? e.message : "Could not attach file") } finally { setBusy(false) }
  }
  const phone = async () => {
    setBusy(true); setError(null)
    try { setHandoff(await assetApi<Handoff>("handoff", options())) } catch (e) { setError(e instanceof Error ? e.message : "Phone upload unavailable") } finally { setBusy(false) }
  }
  const close = () => { cancel.current?.abort(); setOpen(false); setHandoff(null) }
  if (!open) return null
  return <dialog ref={dialog} aria-labelledby="asset-picker-title" onCancel={e => { e.preventDefault(); close() }} className="m-auto max-h-[90dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto rounded-2xl border border-line bg-panel p-5 text-text shadow-2xl backdrop:bg-black/70 sm:p-7">
    <div className="flex items-start justify-between gap-3"><div><h2 id="asset-picker-title" className="text-xl font-semibold">Add files & images</h2><p className="mt-1 text-sm text-muted">Powered by Folders. Choose where your assets belong.</p></div><button type="button" onClick={close} aria-label="Close upload picker" className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-panel-2">✕</button></div>
    <div className="mt-5 grid gap-3 rounded-xl border border-line bg-bg/40 p-4 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">Library & owner<select disabled={busy || loading || !!handoff} value={selected} onChange={e => setSelected(e.target.value)} className="input">{destinations.map(d => <option key={d.folder ? `${d.id}:${d.folder}` : d.id} value={d.folder ? `${d.id}:${d.folder}` : d.id}>{d.name} · {d.owner}{d.canWrite === false ? " (view only)" : ""}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Folder<input value={destination?.folder || folder} disabled={busy || !!destination?.folder || !!handoff} onChange={e => setFolder(e.target.value)} maxLength={120} className="input" placeholder="/Apps/Nexus" /></label>
      <label className="grid gap-1 text-sm">Expiration (optional)<input type="datetime-local" disabled={busy || !!handoff} value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="input" /></label>
      <p className="self-center text-xs leading-relaxed text-muted">Owner: <span className="text-text">{destination?.owner || "You"}</span>. Attaching a file gives this page’s workspace access to it. Folder expiration also applies.</p>
    </div>
    <div className="mt-5 flex gap-2" role="tablist" aria-label="Attachment source">{(["upload", "existing"] as const).map(t => <button key={t} type="button" role="tab" disabled={t === "upload" && destination?.canWrite === false} aria-selected={tab === t} onClick={() => setTab(t)} className={tab === t ? "btn-primary" : "btn-ghost"}>{t === "upload" ? "Upload new" : "Choose from Folders"}</button>)}</div>
    {tab === "upload" ? <div className="mt-4">
      <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-panel-2/40 p-6 text-center hover:border-accent/60" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) setFiles(Array.from(e.dataTransfer.files)) }}><span className="text-3xl" aria-hidden="true">↑</span><span className="font-medium">Choose files or drop them here</span><span className="text-xs text-muted">Images up to 16 MB · other files up to 64 MB · 20 at a time</span><input type="file" multiple disabled={busy} className="sr-only" onChange={e => setFiles(Array.from(e.target.files || []))} /></label>
      <div className="mt-3 flex flex-wrap gap-2"><label className="btn-ghost cursor-pointer">Take a photo<input type="file" accept="image/*" capture="environment" disabled={busy} className="sr-only" onChange={e => setFiles(Array.from(e.target.files || []))} /></label><button type="button" className="btn-ghost" disabled={busy || loading || !destinations.length} onClick={phone}>Upload from phone</button></div>
      {files.length > 0 && <ul className="mt-4 max-h-36 overflow-y-auto rounded-lg border border-line text-sm">{files.map((f, i) => <li key={`${f.name}:${i}`} className="flex items-center gap-2 px-3 py-2"><span className="min-w-0 flex-1 truncate">{f.name}</span><span className="text-xs text-muted">{(f.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" disabled={busy} aria-label={`Remove ${f.name}`} onClick={() => setFiles(list => list.filter((_, index) => index !== i))}>✕</button></li>)}</ul>}
      {busy && <div className="mt-4" aria-live="polite"><progress max={100} value={progress} className="h-2 w-full accent-accent" /><p className="mt-1 text-xs text-muted">Uploading… {Math.round(progress)}%</p></div>}
      <div className="mt-4 flex gap-2"><button type="button" className="btn-primary" disabled={busy || loading || !files.length || !destinations.length || files.length > 20} onClick={upload}>{busy ? "Uploading…" : `Upload${files.length ? ` ${files.length} ${files.length === 1 ? "file" : "files"}` : ""}`}</button>{busy && <button type="button" className="btn-ghost" onClick={() => cancel.current?.abort()}>Cancel upload</button>}</div>
      {handoff && <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-line p-4 text-center"><img src={handoff.qr} width={200} height={200} alt="QR code for uploading to this page from your phone" className="rounded-lg" /><p className="text-sm">Scan with your phone and sign in with the same Axxes account.</p><a href={handoff.url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline">Open phone upload</a><p className="text-xs text-muted">Available until {new Date(handoff.expiresAt).toLocaleTimeString()}. New files appear in this page automatically.</p><button type="button" className="btn-ghost" onClick={() => setHandoff(null)}>Stop watching phone uploads</button></div>}
    </div> : <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-line">{loading ? <p role="status" className="p-5 text-sm text-muted">Loading your assets…</p> : assets.length ? assets.map(a => <div key={a.id} className="flex items-center gap-3 border-b border-line p-3 last:border-0"><span aria-hidden="true">{a.mimeType?.startsWith("image/") ? "▧" : "📎"}</span><div className="min-w-0 flex-1"><p className="truncate text-sm">{a.name}</p><p className="truncate text-xs text-muted">{a.folder || "Unfiled"}</p></div><button type="button" disabled={busy || inserted.current.has(a.id)} onClick={() => attach(a)} className="btn-ghost">{inserted.current.has(a.id) ? "Added" : "Attach"}</button></div>) : <p className="p-5 text-sm text-muted">No available files in this library yet.</p>}</div>}
    {error && <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>}{notice && <p role="status" className="mt-4 text-sm text-accent">{notice}</p>}
    <div className="mt-5 flex items-center justify-between border-t border-line pt-4"><a href={foldersUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-text">Manage assets in Folders ↗</a><button type="button" onClick={close} className="btn-ghost">Done</button></div>
  </dialog>
})
AssetPicker.displayName = "AssetPicker"
