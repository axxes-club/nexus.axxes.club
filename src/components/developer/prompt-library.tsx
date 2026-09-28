"use client"

import { useState } from "react"
import type { Prompt } from "@/lib/developer/import-prompts"

/**
 * The prompt library.
 *
 * Each prompt says which model it was written for, because a prompt tuned
 * for a tool that can read your files is worse than useless pasted into a
 * chat window that cannot. Selecting one reveals it in full rather than
 * making people copy a truncated preview and discover the missing part later.
 */
export function PromptLibrary({ prompts }: { prompts: Prompt[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError("Couldn't reach the clipboard — select the text and copy it manually.")
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      {prompts.map((p) => {
        const open = openId === p.id
        return (
          <div key={p.id} className="overflow-hidden rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : p.id)}
              aria-expanded={open}
              className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-panel-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-text">{p.title}</span>
                <span className="mt-0.5 block text-sm text-muted">{p.blurb}</span>
                <span className="mt-1.5 inline-block rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                  {p.bestFor}
                </span>
              </span>
              <span className="mt-1 shrink-0 text-muted">{open ? "−" : "+"}</span>
            </button>

            {open && (
              <div className="border-t border-line bg-panel-2 p-4">
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-panel p-3 font-mono text-[11px] leading-relaxed text-text">
                  {p.text}
                </pre>
                <button
                  type="button"
                  className="btn-primary mt-3"
                  onClick={() => copy(p.text, p.id)}
                >
                  {copied === p.id ? "Copied" : "Copy prompt"}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
