insert into storage.buckets (id, name, public)
values ('project-media', 'project-media', false)
on conflict (id) do update set public = excluded.public;

create table public.project_media_refs (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  source_id uuid not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  byte_length bigint not null check (byte_length >= 0),
  mime_type text not null,
  storage_path text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, project_id, source_id),
  constraint project_media_refs_storage_path_matches
    check (storage_path = user_id::text || '/' || content_hash)
);

alter table public.project_media_refs enable row level security;

create policy "사용자는 자신의 프로젝트 미디어 참조만 조회할 수 있다"
  on public.project_media_refs
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.project_media_refs from anon, authenticated;
grant select on table public.project_media_refs to authenticated;

create policy "사용자는 자신의 프로젝트 미디어를 업로드할 수 있다"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "사용자는 자신의 프로젝트 미디어를 조회할 수 있다"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "사용자는 자신의 프로젝트 미디어를 다시 업로드할 수 있다"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create or replace function public.register_project_media(
  p_project_id uuid,
  p_source_id uuid,
  p_content_hash text,
  p_byte_length bigint,
  p_mime_type text
)
returns void
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_storage_path text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_content_hash !~ '^[a-f0-9]{64}$' or p_byte_length < 0 or p_mime_type is null then
    raise exception using errcode = '22023', message = 'INVALID_PROJECT_MEDIA';
  end if;

  v_storage_path := v_user_id::text || '/' || p_content_hash;
  if not exists (
    select 1
      from storage.objects
      where bucket_id = 'project-media' and name = v_storage_path
  ) then
    raise exception using errcode = '22023', message = 'PROJECT_MEDIA_OBJECT_MISSING';
  end if;

  insert into public.project_media_refs(
    user_id,
    project_id,
    source_id,
    content_hash,
    byte_length,
    mime_type,
    storage_path
  )
  values (
    v_user_id,
    p_project_id,
    p_source_id,
    p_content_hash,
    p_byte_length,
    p_mime_type,
    v_storage_path
  )
  on conflict (user_id, project_id, source_id)
  do update set
    content_hash = excluded.content_hash,
    byte_length = excluded.byte_length,
    mime_type = excluded.mime_type,
    storage_path = excluded.storage_path,
    updated_at = now();
end;
$$;

revoke all on function public.register_project_media(uuid, uuid, text, bigint, text) from public;
grant execute on function public.register_project_media(uuid, uuid, text, bigint, text) to authenticated;

create or replace function public.validate_project_media_refs()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- 문서가 먼저 보이면 다른 클라이언트가 아직 없는 미디어를 정상 Source로 해석할 수 있어 저장을 거부한다.
  if exists (
    select 1
      from jsonb_array_elements(coalesce(new.document -> 'audioSources', '[]'::jsonb)) as source(value)
      where not exists (
        select 1
          from public.project_media_refs as media_ref
          where media_ref.user_id = new.user_id
            and media_ref.project_id = new.project_id
            and media_ref.source_id = (source.value ->> 'id')::uuid
            and media_ref.byte_length = (source.value ->> 'byteLength')::bigint
            and media_ref.mime_type = source.value ->> 'mimeType'
      )
  ) then
    raise exception using errcode = '22023', message = 'PROJECT_MEDIA_REFS_MISSING';
  end if;

  return new;
end;
$$;

create trigger validate_project_media_refs_before_write
before insert or update on public.project_documents
for each row execute function public.validate_project_media_refs();

revoke all on function public.validate_project_media_refs() from public;
