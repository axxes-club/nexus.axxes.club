"use client"
import { useRef, useState } from "react"
import { genUploader } from "uploadthing/client"
import type { AppFileRouter } from "@/app/api/uploadthing/core"
const uploader = genUploader<AppFileRouter>()
export function PhoneUpload({ pageId, libraryId, folder, intentId, expiresAt }: { pageId: string; libraryId: string; folder: string; intentId: string; expiresAt: string }) {
  const [files, setFiles] = useState<File[]>([])
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const upload = async () => {
    setBusy(true); setNotice(null); setProgress(0); controller.current = new AbortController()
    try {
      const result = await uploader.uploadFiles("nexusAssets", { files, input: { pageId, libraryId, folder, intentId }, signal: controller.current.signal, onUploadProgress: p => setProgress(p.totalProgress) })
      setNotice(`${result.length} files uploaded. They are available on your desktop and in Folders.`); setFiles([])
    } catch (e) { setNotice(e instanceof Error ? e.message : "Upload failed. Try again.") } finally { setBusy(false) }
  }
  return <main className="mx-auto max-w-md p-6"><p className="text-xs uppercase tracking-widest text-accent">Nexus × Folders</p><h1 className="mt-3 text-2xl font-semibold">Upload from your phone</h1><p className="mt-2 text-sm text-muted">Destination: {folder}. Available until {new Date(expiresAt).toLocaleTimeString()}.</p><div className="mt-6 grid gap-3"><label className="btn-primary cursor-pointer">Choose photos or files<input disabled={busy} type="file" multiple className="sr-only" onChange={e => setFiles(Array.from(e.target.files || []))} /></label><label className="btn-ghost cursor-pointer">Take a photo<input disabled={busy} type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => setFiles(Array.from(e.target.files || []))} /></label></div>{files.length > 0 && <ul className="mt-5 space-y-2 text-sm">{files.map((f, i) => <li key={i} className="truncate">{f.name}</li>)}</ul>}{busy && <progress value={progress} max={100} className="mt-5 w-full" />}<button type="button" disabled={busy || !files.length || files.length > 20} onClick={upload} className="btn-primary mt-5 w-full">{busy ? `Uploading… ${Math.round(progress)}%` : "Upload to Nexus"}</button>{busy && <button type="button" className="btn-ghost mt-3 w-full" onClick={() => controller.current?.abort()}>Cancel</button>}{notice && <p role="status" className="mt-5 text-sm">{notice}</p>}<a href="https://dam.axxes.club" className="mt-8 block text-sm text-muted">Open Folders ↗</a></main>
}
