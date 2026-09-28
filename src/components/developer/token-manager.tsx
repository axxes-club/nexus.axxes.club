"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SCOPES } from "@/lib/developer/scopes"

/**
 * Token management.
 *
 * One rule shapes this screen: a secret is shown once. Creating a token
 * reveals it in a panel that cannot be re-opened, and the list below only
 * ever shows a prefix. The copy button is therefore not a nicety — it is the
 * only chance, and the copy says so.
 */
type Token = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt: string | null
  useCount: number
  expiresAt: string | null
  createdAt: string
}

export function TokenManager({ origin }: { origin: string }) {
  const router = useRouter()
  const [tokens, setTokens] = useState<Token[] | null>(null)
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<string[]>([])
  const [expiry, setExpiry] = useState("90")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<{ secret: string; name: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/developer/tokens")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTokens(d?.tokens ?? []))
      .catch(() => setTokens([]))
  }, [])

  const example = (token: string) =>
    `curl -H "Authorization: Bearer ${token}" ${origin}/api/v1/pages`

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch("/api/developer/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scopes, expiresInDays: expiry ? Number(expiry) : null }),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      return setError(d.message ?? "Could not create that token")
    }
    const d = await res.json()
    setRevealed({ secret: d.secret, name: d.token.name })
    setName("")
    setScopes([])
    setCopied(null)
    setTokens((prev) => (prev ? [d.token, ...prev] : [d.token]))
    router.refresh()
  }

  async function revoke(id: string) {
    setBusy(true)
    await fetch(`/api/developer/tokens?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    setBusy(false)
    setRevealed(null)
    setTokens((prev) => (prev ?? []).filter((t) => t.id !== id))
    router.refresh()
  }

  async function copy(value: string, what: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError("Couldn't reach the clipboard — select the text and copy it manually.")
    }
  }

  return (
    <div className="space-y-8">
      {revealed && (
        <section className="rounded-xl border border-accent/40 bg-accent/5 p-5">
          <h3 className="text-sm font-semibold text-text">Your new token</h3>
          <p className="mt-1 text-sm text-muted">
            Copy it now — this is the only time it will ever be shown. If you lose it, revoke this
            token and make another.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel-2 p-3 font-mono text-xs text-text">
            {revealed.secret}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => copy(revealed.secret, "secret")}>
              {copied === "secret" ? "Copied" : "Copy token"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => copy(example(revealed.secret), "curl")}>
              {copied === "curl" ? "Copied" : "Copy as cURL"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setRevealed(null)}>
              I&rsquo;ve saved it
            </button>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel-2 p-3 font-mono text-[11px] text-muted">
            {example(revealed.secret)}
          </pre>
        </section>
      )}

      <form onSubmit={create} className="rounded-xl border border-line p-5">
        <h3 className="text-sm font-semibold text-text">Create a token</h3>
        <p className="mt-1 text-sm text-muted">
          A token acts as you, inside your workspace, with your role. It can never reach more than
          you can.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">What&rsquo;s it for?</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nightly sync from the CMS"
              maxLength={80}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Expires</span>
            <select className="input" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
              <option value="30">In 30 days</option>
              <option value="90">In 90 days</option>
              <option value="365">In a year</option>
              <option value="">Never</option>
            </select>
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-1.5 text-xs font-medium text-muted">Permissions</legend>
          <p className="mb-2 text-xs text-muted">
            Leave all off for a token with everything you can do. Choosing some narrows it.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {SCOPES.map((s) => {
              const on = scopes.includes(s.id)
              return (
                <label
                  key={s.id}
                  className={`cursor-pointer rounded-lg border p-3 transition ${
                    on ? "border-accent bg-accent/5" : "border-line hover:bg-panel-2"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setScopes((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id]))
                      }
                    />
                    <span className="text-sm font-medium text-text">{s.label}</span>
                  </span>
                  <span className="mt-1 block text-xs text-muted">{s.detail}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button type="submit" className="btn-primary mt-4" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Create token"}
        </button>
      </form>

      <section>
        <h3 className="text-sm font-semibold text-text">Your tokens</h3>
        {tokens === null ? (
          <p className="mt-2 text-sm text-muted">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No tokens yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {tokens.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{t.name}</p>
                  <p className="font-mono text-xs text-muted">
                    {t.prefix}…
                    {t.scopes.length > 0 ? ` · ${t.scopes.join(", ")}` : " · full access"}
                    {t.expiresAt
                      ? ` · expires ${new Date(t.expiresAt).toLocaleDateString()}`
                      : " · never expires"}
                  </p>
                  <p className="text-xs text-muted">
                    {t.useCount > 0 && t.lastUsedAt
                      ? `Last used ${new Date(t.lastUsedAt).toLocaleString()} · ${t.useCount} call${
                          t.useCount === 1 ? "" : "s"
                        }`
                      : "Never used"}
                  </p>
                </div>
                <button type="button" className="btn-danger" disabled={busy} onClick={() => revoke(t.id)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
