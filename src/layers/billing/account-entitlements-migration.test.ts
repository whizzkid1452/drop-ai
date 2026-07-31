import { describe, expect, it } from 'vitest';
import { readRepositoryFile } from '../deployment-config.test-utils';

const migrationPath = 'supabase/migrations/202607310001_create_account_entitlements.sql';

describe('account entitlements migration', () => {
  it('외부에 노출되는 권한 테이블에 RLS를 활성화한다', () => {
    const migration = readRepositoryFile(migrationPath);

    expect(migration).toContain('alter table public.account_entitlements enable row level security;');
  });

  it('사용자는 자신의 권한 행만 조회할 수 있다', () => {
    const migration = readRepositoryFile(migrationPath);

    expect(migration).toContain('using ((select auth.uid()) = user_id)');
  });

  it('인증 사용자에게 권한 변경 권한을 부여하지 않는다', () => {
    const migration = readRepositoryFile(migrationPath);

    expect(migration).toContain('revoke insert, update, delete on public.account_entitlements from authenticated;');
  });

  it('신규 사용자의 free 권한을 서버 트리거로 생성한다', () => {
    const migration = readRepositoryFile(migrationPath);

    expect(migration).toContain('after insert on auth.users');
    expect(migration).toContain("values (new.id, 'free', 'active')");
  });
});
