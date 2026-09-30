"use client"

import { useBrand, CustomerLogo, CustomerMark } from "@/components/brand"
import { product } from "@/product.config"

/** Just the badge, for the collapsed rail where the wordmark has no room. */
function AxxesLogoMark() {
  return (
    <span className="mx-auto grid size-7 place-items-center rounded-lg bg-accent font-mono text-sm font-bold text-accent-ink">
      {product.name[0]}
    </span>
  )
}

function AxxesLogo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`grid place-items-center rounded-lg bg-accent font-mono font-bold text-accent-ink ${size === "lg" ? "size-10 text-lg" : "size-7 text-sm"}`}
      >
        {product.name[0]}
      </span>
      <span className="leading-tight">
        <span className={`block font-semibold tracking-tight ${size === "lg" ? "text-xl" : "text-[15px]"}`}>{product.name}</span>
        <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-muted">by AXXES</span>
      </span>
    </div>
  )
}

/** The product logo: a white-label customer's own brand when they have one. */
export function Logo(props: React.ComponentProps<typeof AxxesLogo>) {
  const brand = useBrand()
  const large = (props as { size?: string }).size === "lg"
  return brand ? <CustomerLogo brand={brand} productName={product.name} large={large} /> : <AxxesLogo {...props} />
}

export function LogoMark() {
  const brand = useBrand()
  return brand ? <CustomerMark brand={brand} /> : <AxxesLogoMark />
}
