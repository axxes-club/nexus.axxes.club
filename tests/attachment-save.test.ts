import test from "node:test"
import assert from "node:assert/strict"
import { PGlite } from "@electric-sql/pglite"
import { PgDialect } from "drizzle-orm/pg-core"
import { pageAssetSaveStatement } from "../src/lib/folders/page-assets"

const pageId = "11111111-1111-4111-8111-111111111111"
const tenantId = "22222222-2222-4222-8222-222222222222"
const assetId = "33333333-3333-4333-8333-333333333333"
async function fixture() {
  const pg = new PGlite()
  await pg.exec(`create table nexus_pages(id uuid,tenant_id uuid,title text,content text,icon text,updated_by_id text,updated_at timestamptz,deleted_at timestamptz);
    create table asset_app_grants(asset_id uuid,app_key text,record_id uuid);
    create table asset_app_links(asset_id uuid,app_key text,record_id uuid);
    insert into nexus_pages(id,tenant_id,title,content) values('${pageId}','${tenantId}','Title','Old text');
    insert into asset_app_grants values('${assetId}','nexus','${pageId}');
    insert into asset_app_links values('${assetId}','nexus','${pageId}');`)
  return pg
}
test("saving removed attachments commits text and grant revocation in one statement", async () => {
  const pg = await fixture()
  try {
    const query = new PgDialect().sqlToQuery(pageAssetSaveStatement({ pageId, tenantId, title: "Updated", content: "No attachment", userId: "owner", removed: [assetId] }))
    await pg.query(query.sql, query.params)
    assert.equal((await pg.query<{content:string}>("select content from nexus_pages")).rows[0].content, "No attachment")
    assert.equal((await pg.query("select * from asset_app_grants")).rows.length, 0)
    assert.equal((await pg.query("select * from asset_app_links")).rows.length, 0)
  } finally { await pg.close() }
})
test("wrong workspace cannot save or revoke another page's attachments", async () => {
  const pg = await fixture()
  try {
    const query = new PgDialect().sqlToQuery(pageAssetSaveStatement({ pageId, tenantId: "44444444-4444-4444-8444-444444444444", title: "Changed", content: "Tampered", userId: "other", removed: [assetId] }))
    await pg.query(query.sql, query.params)
    assert.equal((await pg.query<{content:string}>("select content from nexus_pages")).rows[0].content, "Old text")
    assert.equal((await pg.query("select * from asset_app_grants")).rows.length, 1)
  } finally { await pg.close() }
})
