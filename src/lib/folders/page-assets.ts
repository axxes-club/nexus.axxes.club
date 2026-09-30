import { sql } from "drizzle-orm"
export type PageAssetSave = { pageId: string; tenantId: string; title: string; content: string; icon?: string | null; userId: string; removed: string[] }
export function pageAssetSaveStatement(change: PageAssetSave) {
  const candidates = change.removed.length ? sql`asset_id in (${sql.join(change.removed.map(id => sql`${id}::uuid`), sql`, `)})` : sql`false`
  return sql`with saved as (
    update nexus_pages set title=${change.title},content=${change.content},updated_by_id=${change.userId},updated_at=now()
      ${change.icon !== undefined ? sql`,icon=${change.icon}` : sql``}
    where id=${change.pageId}::uuid and tenant_id=${change.tenantId}::uuid and deleted_at is null returning id
  ), revoked as (
    delete from asset_app_grants where app_key='nexus' and record_id=${change.pageId}::uuid and ${candidates} and exists(select 1 from saved) returning asset_id
  ), unlinked as (
    delete from asset_app_links where app_key='nexus' and record_id=${change.pageId}::uuid and asset_id in(select asset_id from revoked) returning asset_id
  ) select id from saved`
}
