import type { MetadataRoute } from "next"

// Installable as a desktop/mobile app
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nexus by AXXES",
    short_name: "Nexus",
    description: "Your team's knowledge base.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  }
}
