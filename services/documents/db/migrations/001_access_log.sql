-- Access history belongs to the documents service database. Storage is unchanged.
begin;
create schema if not exists vault_ui;
do $$
begin
  if not exists (
    select 1 from pg_type
    where typnamespace = 'vault_ui'::regnamespace and typname = 'access_action'
  ) then
    create type vault_ui.access_action as enum ('view', 'modify');
  end if;
end $$;
create table if not exists vault_ui.access_log (
  path text not null,
  accessed_at timestamptz not null default now(),
  action vault_ui.access_action not null,
  primary key (path, accessed_at)
);
create index if not exists access_log_path_accessed_at_idx
  on vault_ui.access_log (path, accessed_at desc);
commit;
