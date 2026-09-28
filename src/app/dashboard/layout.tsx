import { requireContext } from "@/lib/context"
import { Sidebar } from "@/components/sidebar"
import { SignOut } from "@/components/sign-out"
import { Logo } from "@/components/logo"
import { listSpaces } from "@/lib/nexus/data"
import { CommandPalette } from "@/components/nexus/command-palette"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext()
  const spaces = await listSpaces(ctx.tenant.id)
  const items = [{ href: "/dashboard", label: "Home" }, ...spaces.map((sp) => ({ href: `/dashboard/s/${sp.id}`, label: `${sp.icon}  ${sp.name}` }))]

  return (
    <div className="lg:flex">
      <Sidebar
        items={items}
        logo={<Logo />}
        footer={
          <div className="space-y-3 text-xs">
            <p className="rounded-lg border border-line px-2.5 py-1.5 text-muted">Search <kbd className="float-right font-mono">⌘K</kbd></p>
            <div>
              <p className="font-medium text-text">{ctx.tenant.name}</p>
              <p className="truncate text-muted">{ctx.user.email}</p>
            </div>
            <div className="flex items-center justify-between">
              <a className="text-muted hover:text-text" href="https://handshake.axxes.club">← AXXES apps</a>
              <SignOut />
            </div>
          </div>
        }
      />
      <main className="min-w-0 flex-1">{children}</main>
      <CommandPalette />
    </div>
  )
}
