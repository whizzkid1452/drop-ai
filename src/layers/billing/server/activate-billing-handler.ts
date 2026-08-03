import { z } from 'zod';
import {
  activateBillingSubscription,
  BillingActivationError,
  type ActivateBillingDependencies,
} from './activate-billing-subscription';
import { authenticateBillingRequest, createBillingJsonResponse, type AccessTokenVerifier } from './billing-http';
import { BillingProviderError } from './billing-renewal-worker';

interface ActivateBillingHandlerDependencies extends ActivateBillingDependencies {
  readonly verifyAccessToken: AccessTokenVerifier;
}

const activationRequestSchema = z.object({
  authKey: z.string().min(1).max(300),
  customerKey: z.string().min(2).max(300),
});

export function createActivateBillingHandler(
  dependencies: ActivateBillingHandlerDependencies
): (request: Request) => Promise<Response> {
  return async request => {
    if (request.method !== 'POST') {
      return createBillingJsonResponse({ code: 'METHOD_NOT_ALLOWED', message: '지원하지 않는 요청입니다.' }, 405);
    }

    const userId = await authenticateBillingRequest(request, dependencies.verifyAccessToken);
    if (!userId) {
      return createBillingJsonResponse({ code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' }, 401);
    }

    const body = activationRequestSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return createBillingJsonResponse(
        { code: 'INVALID_BILLING_CALLBACK', message: '카드 등록 결과가 올바르지 않습니다.' },
        400
      );
    }

    try {
      const result = await activateBillingSubscription({ userId, ...body.data }, dependencies);
      return createBillingJsonResponse(result, 202);
    } catch (error) {
      if (error instanceof BillingActivationError) {
        return createBillingJsonResponse(
          { code: error.code, message: '카드 등록 요청이 만료되었거나 유효하지 않습니다.' },
          400
        );
      }
      if (error instanceof BillingProviderError) {
        return createBillingJsonResponse({ code: error.code, message: '카드 등록을 완료하지 못했습니다.' }, 502);
      }
      return createBillingJsonResponse(
        { code: 'BILLING_UNAVAILABLE', message: '카드 등록을 완료하지 못했습니다.' },
        503
      );
    }
  };
}
