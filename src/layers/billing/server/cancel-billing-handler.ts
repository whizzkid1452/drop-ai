import { authenticateBillingRequest, createBillingJsonResponse, type AccessTokenVerifier } from './billing-http';

interface CancelBillingHandlerDependencies {
  readonly verifyAccessToken: AccessTokenVerifier;
  scheduleCancellation(userId: string): Promise<boolean>;
  dispatchBillingWorker(): Promise<void>;
}

export function createCancelBillingHandler(
  dependencies: CancelBillingHandlerDependencies
): (request: Request) => Promise<Response> {
  return async request => {
    if (request.method !== 'POST') {
      return createBillingJsonResponse({ code: 'METHOD_NOT_ALLOWED', message: '지원하지 않는 요청입니다.' }, 405);
    }

    const userId = await authenticateBillingRequest(request, dependencies.verifyAccessToken);
    if (!userId) {
      return createBillingJsonResponse({ code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' }, 401);
    }

    try {
      const scheduled = await dependencies.scheduleCancellation(userId);
      if (!scheduled) {
        return createBillingJsonResponse({ code: 'SUBSCRIPTION_NOT_FOUND', message: '취소할 구독이 없습니다.' }, 404);
      }
      await dependencies.dispatchBillingWorker().catch(() => undefined);
      return createBillingJsonResponse({ status: 'cancel_at_period_end' });
    } catch {
      return createBillingJsonResponse({ code: 'BILLING_UNAVAILABLE', message: '구독을 취소할 수 없습니다.' }, 503);
    }
  };
}
