import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { product } from "@/product.config"
import { ServiceWorkerRegistration } from "@/components/sw-register"
import "./globals.css"

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: `${product.name} · AXXES`, template: `%s · ${product.name}` },
  description: product.tagline,
  appleWebApp: { capable: true, title: product.name, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays available; only the double-tap-to-zoom delay is removed.
  maximumScale: 5,
  viewportFit: "cover",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ "--product-accent": product.accent } as React.CSSProperties}>
      <body className={`${sans.variable} ${mono.variable} min-h-dvh`}>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
