export type Attachment = { id: string; name: string; mimeType: string | null }
export type InsertionPoint = { content: string; start: number; end: number }
export function attachmentMarkdown(asset: Attachment, pageId: string): string {
  const label = asset.name.replace(/[\r\n]+/g, " ").replace(/[\\[\]]/g, "\\$&")
  const href = `/api/folders/assets/${encodeURIComponent(asset.id)}?pageId=${encodeURIComponent(pageId)}`
  return `${asset.mimeType?.startsWith("image/") ? "!" : ""}[${label}](${href})`
}
export function insertAttachments(latest: string, point: InsertionPoint, markdown: string): { content: string; cursor: number } {
  if (latest !== point.content) {
    const content = latest + (latest.endsWith("\n\n") || !latest ? "" : "\n\n") + markdown + "\n"
    return { content, cursor: content.length }
  }
  const before = latest.slice(0, point.start)
  const after = latest.slice(point.end)
  const inserted = (before && !before.endsWith("\n") ? "\n" : "") + markdown + "\n"
  return { content: before + inserted + after, cursor: before.length + inserted.length }
}
export function referencedAttachmentIds(content: string): string[] {
  const outsideCode = content.replace(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?\1|`+[^`\n]*`+/g, "")
  return [...new Set(Array.from(outsideCode.matchAll(/\]\(\/api\/folders\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\?[^\s)]*)?\)/gi), m => m[1]))]
}
export function removedAttachmentIds(previous: string, next: string): string[] {
  const retained = new Set(referencedAttachmentIds(next))
  return referencedAttachmentIds(previous).filter(id => !retained.has(id))
}
