import Link from "next/link"
import { Logo } from "@/components/logo"

export const metadata = {
  title: "Nexus — your team's knowledge base",
  description: "Docs, wikis and an intranet your team will actually use. Linked pages, instant search and full history. Part of AXXES.",
}

const FEATURES = [
  ["Spaces & nested pages", "Give every team or venue its own space, and nest pages as deep as your handbook needs."],
  ["Link everything", "Type [[Page name]] to link pages. Backlinks show everywhere a page is mentioned — your knowledge becomes a graph."],
  ["Write fast", "Markdown with a toolbar, split preview, tables, task lists and keyboard shortcuts. Autosaves as you type."],
  ["Find anything", "⌘K searches every title and paragraph across your workspace in milliseconds."],
  ["Nothing is lost", "Every page keeps a version history. Restore any version in one click."],
  ["Installs like an app", "Add Nexus to your dock or home screen. Same AXXES account as the rest of the suite."],
]

export default function Home() {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="rounded-lg px-3 py-2 text-muted hover:text-text">Sign in</Link>
          <Link href="/dashboard" className="btn-primary">Open Nexus</Link>
        </nav>
      </header>
      <main>
        <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 lg:pt-24">
          <div aria-hidden className="pointer-events-none absolute -top-24 right-0 h-96 w-[640px] rounded-full bg-accent/15 blur-[130px]" />
          <p className="relative font-mono text-[11px] uppercase tracking-[0.3em] text-accent">Nexus by AXXES</p>
          <h1 className="relative mt-5 max-w-3xl text-5xl font-semibold leading-[1.03] tracking-tight sm:text-7xl">Everything your team knows, <span className="text-accent">linked.</span></h1>
          <p className="relative mt-6 max-w-xl text-lg text-muted">Docs, wikis, SOPs and an intranet in one place — fast to write, instant to search, impossible to lose.</p>
          <div className="relative mt-8 flex gap-3">
            <Link href="/dashboard" className="btn-primary px-5 py-3 text-base">Start a space</Link>
            <a href="#features" className="btn-ghost px-5 py-3 text-base">Features</a>
          </div>

          <div aria-hidden className="card relative mt-16 grid overflow-hidden md:grid-cols-[220px_1fr]">
            <div className="hidden border-r border-line p-4 text-sm md:block">
              <p className="mb-3 font-semibold">🎛️ Venue ops</p>
              {["🏠 Venue ops home", "📋 Opening checklist", "   🔊 Sound check", "   🚪 Door policy", "🧯 Emergency plan", "📞 Vendor contacts"].map((t) => (
                <p key={t} className={`whitespace-pre rounded-md px-2 py-1.5 ${t.includes("Door") ? "bg-panel-2 text-text" : "text-muted"}`}>{t}</p>
              ))}
            </div>
            <div className="p-8">
              <p className="text-3xl font-semibold">🚪 Door policy</p>
              <p className="mt-2 text-xs text-muted">Last edited 2 minutes ago by Maya</p>
              <p className="mt-6 text-sm leading-relaxed text-muted">Capacity is <span className="text-text">350</span>. Check IDs for everyone. Guest list closes at <span className="text-text">1:00</span> — see <span className="text-accent underline">Opening checklist</span> and the <span className="text-accent underline">Emergency plan</span>.</p>
              <ul className="mt-4 space-y-1.5 text-sm"><li>☑ Wristbands at the door</li><li>☐ Brief security at 21:30</li></ul>
            </div>
          </div>
        </section>
        <section id="features" className="border-t border-line/60 bg-panel/40">
          <div className="mx-auto grid max-w-6xl scroll-mt-16 gap-2 px-4 py-20 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {FEATURES.map(([t, b]) => (
              <div key={t} className="p-6"><h3 className="font-medium">{t}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{b}</p></div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-line/60">
        <div className="mx-auto flex max-w-6xl justify-between px-4 py-8 text-sm text-muted sm:px-6">
          <Logo />
          <a href="https://handshake.axxes.club/apps" className="hover:text-text">All AXXES apps</a>
        </div>
      </footer>
    </div>
  )
}
