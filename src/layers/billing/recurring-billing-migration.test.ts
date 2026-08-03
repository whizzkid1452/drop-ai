import { describe, expect, it } from 'vitest';
import { readRepositoryFile } from '../deployment-config.test-utils';

const migrationPath = 'supabase/migrations/202607310002_create_recurring_billing.sql';

describe('recurring billing migration', () => {
  it('빌링키·구독·주문 테이블의 브라우저 접근을 차단한다', () => {
    const migration = readRepositoryFile(migrationPath);

    expect(migration).toContain('revoke all on public.billing_subscriptions from anon, authenticated;');
    expect(migration).toContain('revoke all on public.billing_orders from anon, authenticated;');
  });

  it('동시 worker가 같은 구독을 가져가지 않도록 행 잠금을 사용한다', () => {
    const migration = readRepositoryFile(migrationPath);

    expect(migration).toContain('for update skip locked');
  });

  it('결제 성공과 Pro 권한 변경을 같은 데이터베이스 함수에서 처리한다', () => {
    const migration = readRepositoryFile(migrationPath);

    expect(migration).toContain('function public.complete_billing_charge');
    expect(migration).toContain("values (p_user_id, 'pro', 'active', p_period_end)");
  });

  it('결제 서버 함수는 service_role만 실행할 수 있다', () => {
    const migration = readRepositoryFile(migrationPath);

    expect(migration).toContain('from public, anon, authenticated;');
    expect(migration).toContain('to service_role;');
  });
});
