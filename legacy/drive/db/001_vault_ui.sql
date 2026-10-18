create schema if not exists vault_ui;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'vault_ui'::regnamespace and typname = 'favorite_type') then
    create type vault_ui.favorite_type as enum ('file', 'folder');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'vault_ui'::regnamespace and typname = 'access_action') then
    create type vault_ui.access_action as enum ('view', 'modify');
  end if;
end $$;

create table if not exists vault_ui.favorites (
  id bigserial primary key,
  path text not null unique,
  type vault_ui.favorite_type not null,
  is_folder_of_favorites boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists vault_ui.favorite_folders (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists vault_ui.favorite_folder_items (
  folder_id bigint not null references vault_ui.favorite_folders(id) on delete cascade,
  favorite_id bigint not null references vault_ui.favorites(id) on delete cascade,
  primary key (folder_id, favorite_id)
);

create table if not exists vault_ui.access_log (
  path text not null,
  accessed_at timestamptz not null default now(),
  action vault_ui.access_action not null,
  primary key (path, accessed_at)
);

create table if not exists vault_ui.document_index (
  path text primary key,
  filename text not null,
  extracted_text tsvector not null,
  file_type text not null,
  indexed_at timestamptz not null default now()
);

create index if not exists access_log_path_accessed_at_idx
  on vault_ui.access_log (path, accessed_at desc);

create index if not exists document_index_extracted_text_idx
  on vault_ui.document_index using gin (extracted_text);
