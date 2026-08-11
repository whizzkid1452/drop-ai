import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/202608110001_list_project_crdt_projects.sql';

describe('원격 프로젝트 탐색 migration', () => {
  it('인증 사용자의 CRDT 프로젝트만 집계하는 RPC를 만든다', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('create or replace function public.list_project_crdt_projects()');
    expect(migration).toContain('security invoker');
    expect(migration).toContain('updates.user_id = auth.uid()');
    expect(migration).toContain('group by updates.project_id');
    expect(migration).toContain('grant execute on function public.list_project_crdt_projects() to authenticated');
    expect(migration).toContain('revoke all on function public.list_project_crdt_projects() from public');
  });
});
