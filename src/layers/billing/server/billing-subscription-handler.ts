import { authenticateBillingRequest, createBillingJsonResponse, type AccessTokenVerifier } from './billing-http';

export type BillingSubscriptionStatus = 'pending' | 'active' | 'cancel_at_period_end' | 'past_due' | 'canceled';

export interface BillingSubscriptionSummary {
  readonly status: BillingSubscriptionStatus;
  readonly amountKrw: number;
  readonly currentPeriodEnd: string | null;
  readonly cardLastFour: string | null;
}

interface BillingSubscriptionHandlerDependencies {
  readonly verifyAccessToken: AccessTokenVerifier;
  readBillingSubscription(userId: string): Promise<BillingSubscriptionSummary | null>;
}

const NO_SUBSCRIPTION = {
  status: 'none',
  amountKrw: null,
  currentPeriodEnd: null,
  cardLastFour: null,
} as const;

export function createBillingSubscriptionHandler(
  dependencies: BillingSubscriptionHandlerDependencies
): (request: Request) => Promise<Response> {
  return async request => {
    if (request.method !== 'GET') {
      return createBillingJsonResponse({ code: 'METHOD_NOT_ALLOWED', message: '지원하지 않는 요청입니다.' }, 405);
    }

    const userId = await authenticateBillingRequest(request, dependencies.verifyAccessToken);
    if (!userId) {
      return createBillingJsonResponse({ code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' }, 401);
    }

    try {
      const subscription = await dependencies.readBillingSubscription(userId);
      return createBillingJsonResponse(subscription ?? NO_SUBSCRIPTION);
    } catch {
      return createBillingJsonResponse(
        { code: 'BILLING_UNAVAILABLE', message: '구독 상태를 확인할 수 없습니다.' },
        503
      );
    }
  };
}
