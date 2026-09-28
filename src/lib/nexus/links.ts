// [[Page title]] or [[Page title|shown text]]
export const WIKI_LINK = /\[\[([^\]|]{1,200})(?:\|([^\]]{1,200}))?\]\]/g

export function linkedTitles(content: string) {
  const titles = new Set<string>()
  for (const m of content.matchAll(WIKI_LINK)) titles.add(m[1].trim().toLowerCase())
  return [...titles]
}

// Turn wiki links into markdown links; unknown titles become "create this page" links.
// Code spans and fenced blocks are left alone, so `[[examples]]` stay literal.
export function renderWikiLinks(content: string, resolve: (title: string) => string | null) {
  return content
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(WIKI_LINK, (_, title: string, label?: string) => {
            const href = resolve(title.trim())
            const text = (label ?? title).trim()
            return href ? `[${text}](${href})` : `[${text}](#new:${encodeURIComponent(title.trim())})`
          })
    )
    .join("")
}

// Titles linked outside code, for the backlink graph
export function linkedTitlesOutsideCode(content: string) {
  return linkedTitles(content.replace(/```[\s\S]*?```|`[^`\n]*`/g, ""))
}
