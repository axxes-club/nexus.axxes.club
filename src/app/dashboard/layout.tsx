import { AllAppsSwitcher } from "@/components/all-apps-switcher"
import type { Metadata } from "next"
import { BrandScope } from "@/components/brand"
import { getCustomerBrand } from "@/lib/white-label"
import { requireContext } from "@/lib/context"
import { Sidebar } from "@/components/sidebar"
import { SignOut } from "@/components/sign-out"
import { Logo, LogoMark } from "@/components/logo"
import { listSpaces } from "@/lib/nexus/data"
import { CommandPalette } from "@/components/nexus/command-palette"
import { OrgSwitcher } from "@/components/org-switcher"

async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext()
  const spaces = await listSpaces(ctx.tenant.id)
  const items = [
    { href: "/dashboard", label: "Home" },
    // The icon rides along so the collapsed rail can show a glyph per space
    // instead of a truncated first letter.
    ...spaces.map((sp) => ({ href: `/dashboard/s/${sp.id}`, label: sp.name, icon: sp.icon })),
    { href: "/dashboard/developer", label: "Developer" },
  ]

  return (
    <div className="lg:flex">
      <Sidebar
        items={items}
        logo={<Logo />}
        mark={<LogoMark />}
        apps={<AllAppsSwitcher tenantId={ctx.tenant.id} />}
        organization={<OrgSwitcher current={{ tenantId: ctx.tenant.id, name: ctx.tenant.name, slug: ctx.tenant.slug, role: ctx.role, isPrimary: false }} memberships={ctx.memberships} />}
        footer={
          <div className="space-y-3 text-xs">
            <p className="rounded-lg border border-line px-2.5 py-1.5 text-muted">Search <kbd className="float-right font-mono">⌘K</kbd></p>
            <p className="truncate text-muted">{ctx.user.email}</p>
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

/** White-label customers see their own brand; everyone else, standard AXXES. */
export default async function BrandedLayout(props: Parameters<typeof DashboardLayout>[0]) {
  const ctx = await requireContext()
  const brand = ctx ? await getCustomerBrand(ctx.tenant.id) : null
  return <BrandScope brand={brand}>{await DashboardLayout(props)}</BrandScope>
}

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireContext()
  const brand = ctx ? await getCustomerBrand(ctx.tenant.id) : null
  return brand?.faviconUrl ? { icons: { icon: brand.faviconUrl } } : {}
}
