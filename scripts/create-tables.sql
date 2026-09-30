-- Nexus tables. Additive only: creates nexus_* tables, never alters shared ones.
create table if not exists nexus_spaces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  icon text not null default '📘',
  description text,
  created_by_id text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists nexus_spaces_tenant_idx on nexus_spaces (tenant_id);

create table if not exists nexus_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  space_id uuid not null,
  parent_id uuid,
  title text not null default 'Untitled',
  icon text,
  content text not null default '',
  position integer not null default 0,
  created_by_id text not null,
  updated_by_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists nexus_pages_space_idx on nexus_pages (space_id, parent_id);
create index if not exists nexus_pages_tenant_idx on nexus_pages (tenant_id, updated_at);

create table if not exists nexus_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null,
  title text not null,
  content text not null,
  author_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists nexus_versions_page_idx on nexus_page_versions (page_id, created_at);

create table if not exists nexus_links (
  from_page_id uuid not null,
  to_page_id uuid not null,
  primary key (from_page_id, to_page_id)
);
create index if not exists nexus_links_to_idx on nexus_links (to_page_id);

-- Wiki links resolve by title, case-insensitively and tenant-wide, so the lookup
-- filters on lower(title). Without this index every page view scans every page
-- the tenant owns.
create index if not exists nexus_pages_title_lower_idx on nexus_pages (lower(title));
