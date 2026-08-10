create table public.project_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  revision bigint not null check (revision >= 0),
  document jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, project_id),
  constraint project_documents_document_id_matches
    check (document #>> '{project,id}' = project_id::text),
  constraint project_documents_document_revision_matches
    check ((document #>> '{project,revision}')::bigint = revision)
);

create table public.project_change_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  project_id uuid not null,
  local_revision bigint not null check (local_revision >= 0),
  applied_at timestamptz not null default now(),
  primary key (user_id, operation_id),
  foreign key (user_id, project_id)
    references public.project_documents(user_id, project_id)
    on delete cascade
);

alter table public.project_documents enable row level security;
alter table public.project_change_receipts enable row level security;

create policy "사용자는 자신의 프로젝트 문서만 조회할 수 있다"
  on public.project_documents
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "사용자는 자신의 프로젝트 변경 영수증만 조회할 수 있다"
  on public.project_change_receipts
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.project_documents from anon, authenticated;
revoke all on table public.project_change_receipts from anon, authenticated;
grant select on table public.project_documents to authenticated;
grant select on table public.project_change_receipts to authenticated;

create or replace function public.apply_project_change(
  p_project_id uuid,
  p_operation_id uuid,
  p_base_revision bigint,
  p_local_revision bigint,
  p_document jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_server_revision bigint;
  v_receipt_project_id uuid;
  v_receipt_local_revision bigint;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_local_revision < 0 or p_document is null then
    raise exception using errcode = '22023', message = 'INVALID_PROJECT_CHANGE';
  end if;
  if p_document #>> '{project,id}' is distinct from p_project_id::text
    or (p_document #>> '{project,revision}')::bigint is distinct from p_local_revision then
    raise exception using errcode = '22023', message = 'PROJECT_DOCUMENT_MISMATCH';
  end if;

  -- 최초 문서에는 잠글 행이 없으므로 사용자·프로젝트 키로 transaction 범위 상호 배제를 적용한다.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_project_id::text, 0));

  select project_id, local_revision
    into v_receipt_project_id, v_receipt_local_revision
    from public.project_change_receipts
    where user_id = v_user_id and operation_id = p_operation_id;

  if found then
    if v_receipt_project_id is distinct from p_project_id
      or v_receipt_local_revision is distinct from p_local_revision then
      raise exception using errcode = '22023', message = 'OPERATION_ID_REUSED';
    end if;
    return jsonb_build_object(
      'operationId', p_operation_id,
      'serverRevision', v_receipt_local_revision,
      'status', 'already_applied'
    );
  end if;

  select revision
    into v_server_revision
    from public.project_documents
    where user_id = v_user_id and project_id = p_project_id
    for update;

  if not found then
    if p_base_revision is not null or p_local_revision <> 0 then
      return jsonb_build_object(
        'operationId', p_operation_id,
        'serverRevision', 0,
        'status', 'revision_conflict'
      );
    end if;

    insert into public.project_documents(user_id, project_id, revision, document)
    values (v_user_id, p_project_id, p_local_revision, p_document);
  else
    if p_base_revision is distinct from v_server_revision
      or p_local_revision <> p_base_revision + 1 then
      return jsonb_build_object(
        'operationId', p_operation_id,
        'serverRevision', v_server_revision,
        'status', 'revision_conflict'
      );
    end if;

    update public.project_documents
      set revision = p_local_revision,
          document = p_document,
          updated_at = now()
      where user_id = v_user_id and project_id = p_project_id;
  end if;

  insert into public.project_change_receipts(user_id, operation_id, project_id, local_revision)
  values (v_user_id, p_operation_id, p_project_id, p_local_revision);

  return jsonb_build_object(
    'operationId', p_operation_id,
    'serverRevision', p_local_revision,
    'status', 'applied'
  );
end;
$$;

revoke all on function public.apply_project_change(uuid, uuid, bigint, bigint, jsonb) from public;
grant execute on function public.apply_project_change(uuid, uuid, bigint, bigint, jsonb) to authenticated;
