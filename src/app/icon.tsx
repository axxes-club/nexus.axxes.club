import { ImageResponse } from "next/og"

export const size = { width: 512, height: 512 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2dd4bf", borderRadius: 112, fontSize: 300, fontWeight: 800, color: "#0a0a0b" }}>N</div>,
    size
  )
}
