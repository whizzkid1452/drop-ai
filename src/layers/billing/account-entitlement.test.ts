import { describe, expect, it } from 'vitest';
import { accountEntitlementSchema } from './account-entitlement';

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
