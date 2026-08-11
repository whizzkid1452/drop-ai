create or replace function public.list_project_crdt_projects()
returns table (
  project_id uuid,
  latest_sequence_id bigint,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    updates.project_id,
    max(updates.sequence_id) as latest_sequence_id,
    max(updates.created_at) as updated_at
  from public.project_crdt_updates as updates
  where updates.user_id = auth.uid()
  group by updates.project_id
  order by max(updates.created_at) desc, updates.project_id;
$$;

revoke all on function public.list_project_crdt_projects() from public;
grant execute on function public.list_project_crdt_projects() to authenticated;
