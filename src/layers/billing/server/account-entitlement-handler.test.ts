import { describe, expect, it, vi } from 'vitest';
import { createAccountEntitlementHandler, type AccountEntitlementDependencies } from './account-entitlement-handler';

const AUTHENTICATED_USER_ID = 'b42177fe-8b1f-4cad-92db-9e3f2389deeb';

function createDependencies(overrides: Partial<AccountEntitlementDependencies> = {}): AccountEntitlementDependencies {
  return {
    verifyAccessToken: vi.fn().mockResolvedValue({ userId: AUTHENTICATED_USER_ID }),
    readAccountEntitlement: vi.fn().mockResolvedValue({
      planCode: 'pro',
      status: 'active',
      currentPeriodEnd: '2026-08-31T00:00:00.000Z',
    }),
    ...overrides,
  };
}

function createRequest(authorization = 'Bearer valid-access-token'): Request {
  return new Request('https://drop.example.com/api/account/entitlement', {
    headers: { authorization },
  });
}

describe('account entitlement handler', () => {
  it('Bearer 토큰이 없으면 요청을 거절한다', async () => {
    const dependencies = createDependencies();
    const handler = createAccountEntitlementHandler(dependencies);

    const response = await handler(new Request('https://drop.example.com/api/account/entitlement'));

    expect(response.status).toBe(401);
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('검증되지 않은 토큰이면 요청을 거절한다', async () => {
    const dependencies = createDependencies({
      verifyAccessToken: vi.fn().mockResolvedValue(null),
    });
    const handler = createAccountEntitlementHandler(dependencies);

    const response = await handler(createRequest());

    expect(response.status).toBe(401);
    expect(dependencies.readAccountEntitlement).not.toHaveBeenCalled();
  });

  it('토큰으로 확인한 사용자 ID로 권한을 조회한다', async () => {
    const dependencies = createDependencies();
    const handler = createAccountEntitlementHandler(dependencies);

    await handler(createRequest());

    expect(dependencies.readAccountEntitlement).toHaveBeenCalledWith(AUTHENTICATED_USER_ID);
  });

  it('저장된 권한이 없으면 free 권한을 반환한다', async () => {
    const dependencies = createDependencies({
      readAccountEntitlement: vi.fn().mockResolvedValue(null),
    });
    const handler = createAccountEntitlementHandler(dependencies);

    const response = await handler(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      planCode: 'free',
      status: 'active',
      currentPeriodEnd: null,
    });
  });

  it('GET 이외의 메서드는 거절한다', async () => {
    const dependencies = createDependencies();
    const handler = createAccountEntitlementHandler(dependencies);
    const request = new Request('https://drop.example.com/api/account/entitlement', {
      method: 'POST',
      headers: { authorization: 'Bearer valid-access-token' },
    });

    const response = await handler(request);

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });

  it('내부 저장소 오류의 상세 내용을 노출하지 않는다', async () => {
    const dependencies = createDependencies({
      readAccountEntitlement: vi.fn().mockRejectedValue(new Error('database password leaked')),
    });
    const handler = createAccountEntitlementHandler(dependencies);

    const response = await handler(createRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: 'ENTITLEMENT_UNAVAILABLE',
      message: '계정 권한을 확인할 수 없습니다.',
    });
  });
});
