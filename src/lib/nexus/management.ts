export function descendantIds(pages: readonly { id: string; parentId: string | null }[], rootId: string): Set<string> {
  const ids = new Set([rootId])
  for (let grew = true; grew;) {
    grew = false
    for (const page of pages) if (page.parentId && ids.has(page.parentId) && !ids.has(page.id)) { ids.add(page.id); grew = true }
  }
  return ids
}
export function menuPosition(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  return { left: Math.max(8, Math.min(x, viewportWidth - width - 8)), top: Math.max(8, Math.min(y, viewportHeight - height - 8)) }
}

export async function duplicateWithCleanup<T>(create: () => Promise<T>, populate: (copy: T) => Promise<void>, cleanup: (copy: T) => Promise<void>): Promise<T> {
  const copy = await create()
  try { await populate(copy); return copy }
  catch (error) { await cleanup(copy); throw error }
}

export function assertMutationRole(role: string, destructive = false): void {
  const allowed = destructive ? ['owner', 'admin', 'manager'] : ['owner', 'admin', 'manager', 'member']
  if (!allowed.includes(role)) throw new Error('You do not have permission to perform this action')
}
