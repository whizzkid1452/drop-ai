import { describe, expect, it } from 'vitest';
import { accountEntitlementSchema, hasActiveProEntitlement } from './account-entitlement';

describe('accountEntitlementSchema', () => {
  it('Postgres가 반환하는 UTC offset 날짜를 허용한다', () => {
    const entitlement = accountEntitlementSchema.parse({
      planCode: 'pro',
      status: 'active',
      currentPeriodEnd: '2026-08-31T09:00:00+09:00',
    });

    expect(entitlement.currentPeriodEnd).toBe('2026-08-31T09:00:00+09:00');
  });
});

describe('hasActiveProEntitlement', () => {
  it('현재 시각보다 종료 시각이 뒤인 active Pro 권한만 허용한다', () => {
    const hasAccess = hasActiveProEntitlement(
      {
        planCode: 'pro',
        status: 'active',
        currentPeriodEnd: '2026-08-31T00:00:00.000Z',
      },
      new Date('2026-07-31T00:00:00.000Z')
    );

    expect(hasAccess).toBe(true);
  });

  it('종료 시각과 현재 시각이 같으면 권한을 만료 처리한다', () => {
    const hasAccess = hasActiveProEntitlement(
      {
        planCode: 'pro',
        status: 'active',
        currentPeriodEnd: '2026-07-31T00:00:00.000Z',
      },
      new Date('2026-07-31T00:00:00.000Z')
    );

    expect(hasAccess).toBe(false);
  });

  it('free 또는 past_due 권한은 허용하지 않는다', () => {
    expect(hasActiveProEntitlement({ planCode: 'free', status: 'active', currentPeriodEnd: null })).toBe(false);
    expect(
      hasActiveProEntitlement({
        planCode: 'pro',
        status: 'past_due',
        currentPeriodEnd: '2026-08-31T00:00:00.000Z',
      })
    ).toBe(false);
  });
});
