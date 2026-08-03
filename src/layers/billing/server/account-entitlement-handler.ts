import { FREE_ACCOUNT_ENTITLEMENT, type AccountEntitlement } from '../account-entitlement';

interface VerifiedUser {
  readonly userId: string;
}

export interface AccountEntitlementDependencies {
  verifyAccessToken(accessToken: string): Promise<VerifiedUser | null>;
  readAccountEntitlement(userId: string): Promise<AccountEntitlement | null>;
}

type AccountEntitlementHandler = (request: Request) => Promise<Response>;

const JSON_HEADERS = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  vary: 'Authorization',
};

function createJsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
}

export function createAccountEntitlementHandler({
  verifyAccessToken,
  readAccountEntitlement,
}: AccountEntitlementDependencies): AccountEntitlementHandler {
  return async request => {
    if (request.method !== 'GET') {
      return createJsonResponse({ code: 'METHOD_NOT_ALLOWED', message: '지원하지 않는 요청입니다.' }, 405, {
        allow: 'GET',
      });
    }

    const accessToken = readBearerToken(request);
    if (!accessToken) {
      return createJsonResponse({ code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' }, 401);
    }

    try {
      const verifiedUser = await verifyAccessToken(accessToken);
      if (!verifiedUser) {
        return createJsonResponse({ code: 'INVALID_ACCESS_TOKEN', message: '로그인이 만료되었습니다.' }, 401);
      }

      // 요청 본문의 사용자 ID를 신뢰하지 않고 검증된 토큰의 사용자 ID만 조회에 사용한다.
      const entitlement = await readAccountEntitlement(verifiedUser.userId);
      return createJsonResponse(entitlement ?? FREE_ACCOUNT_ENTITLEMENT);
    } catch {
      return createJsonResponse(
        {
          code: 'ENTITLEMENT_UNAVAILABLE',
          message: '계정 권한을 확인할 수 없습니다.',
        },
        503
      );
    }
  };
}
