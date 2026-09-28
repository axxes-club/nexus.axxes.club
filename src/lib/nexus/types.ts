export type TreePage = { id: string; parentId: string | null; title: string; icon: string | null; position: number }
export type SpaceT = { id: string; name: string; icon: string; description: string | null }
export type PageT = {
  id: string
  spaceId: string
  parentId: string | null
  title: string
  icon: string | null
  content: string
  updatedAt: string
  updatedBy: string | null
}
export type LinkT = { id: string; title: string; icon: string | null; spaceId: string }
