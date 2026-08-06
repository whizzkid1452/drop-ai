import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/202608060002_create_project_media.sql';

describe('프로젝트 미디어 migration', () => {
  it('private Storage bucket과 사용자별 Source 참조 RPC를 정의한다', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain("values ('project-media', 'project-media', false)");
    expect(migration).toContain('create table public.project_media_refs');
    expect(migration).toContain('create or replace function public.register_project_media');
    expect(migration).toContain('create trigger validate_project_media_refs_before_write');
    expect(migration).toContain('PROJECT_MEDIA_REFS_MISSING');
    expect(migration).toContain("bucket_id = 'project-media'");
    expect(migration).toContain('(storage.foldername(name))[1] = (select auth.uid()::text)');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('security definer');
  });
});
