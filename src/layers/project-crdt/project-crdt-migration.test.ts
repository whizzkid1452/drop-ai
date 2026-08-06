import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/202608060003_create_project_crdt_updates.sql';

describe('프로젝트 CRDT update migration', () => {
  it('사용자·프로젝트별 append-only update log와 idempotent RPC를 정의한다', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('create table public.project_crdt_updates');
    expect(migration).toContain('generated always as identity');
    expect(migration).toContain('unique (user_id, operation_id)');
    expect(migration).toContain('create or replace function public.append_project_crdt_update');
    expect(migration).toContain('already_applied');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('auth.uid()');
  });
});
