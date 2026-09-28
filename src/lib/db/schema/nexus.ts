import { index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core"

// Nexus's own tables (prefixed; created by scripts/create-tables.sql)

export const nexusSpaces = pgTable(
  "nexus_spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("📘"),
    description: text("description"),
    createdById: text("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("nexus_spaces_tenant_idx").on(t.tenantId)]
)

export const nexusPages = pgTable(
  "nexus_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    spaceId: uuid("space_id").notNull(),
    parentId: uuid("parent_id"),
    title: text("title").notNull().default("Untitled"),
    icon: text("icon"),
    content: text("content").notNull().default(""),
    position: integer("position").notNull().default(0),
    createdById: text("created_by_id").notNull(),
    updatedById: text("updated_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("nexus_pages_space_idx").on(t.spaceId, t.parentId), index("nexus_pages_tenant_idx").on(t.tenantId, t.updatedAt)]
)

// Snapshots taken as a page is edited, so any version can be restored
export const nexusPageVersions = pgTable(
  "nexus_page_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    authorId: text("author_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("nexus_versions_page_idx").on(t.pageId, t.createdAt)]
)

// [[Page]] references, rebuilt on save, for backlinks and the knowledge graph
export const nexusLinks = pgTable(
  "nexus_links",
  {
    fromPageId: uuid("from_page_id").notNull(),
    toPageId: uuid("to_page_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.fromPageId, t.toPageId] }), index("nexus_links_to_idx").on(t.toPageId)]
)
