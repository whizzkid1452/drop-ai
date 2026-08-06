create table public.project_crdt_updates (
  sequence_id bigint generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  operation_id uuid not null,
  update_base64 text not null check (length(update_base64) > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, project_id, sequence_id),
  unique (user_id, operation_id)
);

create index project_crdt_updates_project_sequence_idx
  on public.project_crdt_updates(user_id, project_id, sequence_id);

alter table public.project_crdt_updates enable row level security;

create policy "사용자는 자신의 프로젝트 CRDT update만 조회할 수 있다"
  on public.project_crdt_updates
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.project_crdt_updates from anon, authenticated;
grant select on table public.project_crdt_updates to authenticated;

create or replace function public.append_project_crdt_update(
  p_project_id uuid,
  p_operation_id uuid,
  p_update_base64 text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_project_id uuid;
  v_sequence_id bigint;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_update_base64 is null or length(p_update_base64) = 0 then
    raise exception using errcode = '22023', message = 'INVALID_CRDT_UPDATE';
  end if;

  -- 같은 operation의 동시 재시도가 unique violation으로 끝나지 않고 동일한 receipt를 읽도록 직렬화한다.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_operation_id::text, 0));

  select project_id, sequence_id
    into v_existing_project_id, v_sequence_id
    from public.project_crdt_updates
    where user_id = v_user_id and operation_id = p_operation_id;

  if found then
    if v_existing_project_id is distinct from p_project_id then
      raise exception using errcode = '22023', message = 'OPERATION_ID_REUSED';
    end if;
    return jsonb_build_object(
      'operationId', p_operation_id,
      'sequenceId', v_sequence_id,
      'status', 'already_applied'
    );
  end if;

  insert into public.project_crdt_updates(user_id, project_id, operation_id, update_base64)
  values (v_user_id, p_project_id, p_operation_id, p_update_base64)
  returning sequence_id into v_sequence_id;

  return jsonb_build_object(
    'operationId', p_operation_id,
    'sequenceId', v_sequence_id,
    'status', 'applied'
  );
end;
$$;

revoke all on function public.append_project_crdt_update(uuid, uuid, text) from public;
grant execute on function public.append_project_crdt_update(uuid, uuid, text) to authenticated;
