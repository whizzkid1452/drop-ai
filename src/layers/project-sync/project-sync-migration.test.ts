import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/202608060001_create_project_sync.sql';

describe('프로젝트 동기화 migration', () => {
  it('사용자별 문서와 operation 영수증을 저장하는 RPC를 정의한다', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('create table public.project_documents');
    expect(migration).toContain('create table public.project_change_receipts');
    expect(migration).toContain('create or replace function public.apply_project_change');
    expect(migration).toContain('security definer');
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('revision_conflict');
    expect(migration).toContain('enable row level security');
  });
});
