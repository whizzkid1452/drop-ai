import { randomUUID } from 'node:crypto';
import { authenticateBillingRequest, createBillingJsonResponse, type AccessTokenVerifier } from './billing-http';
import { createBillingIntent, type CreateBillingIntentDependencies } from './create-billing-intent';

interface CreateBillingIntentHandlerDependencies
  extends Omit<CreateBillingIntentDependencies, 'createCustomerKey' | 'now'> {
  readonly verifyAccessToken: AccessTokenVerifier;
  createCustomerKey?(): string;
  now?(): Date;
}

export function createBillingIntentHandler(
  dependencies: CreateBillingIntentHandlerDependencies
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
      const intent = await createBillingIntent(userId, {
        ...dependencies,
        createCustomerKey: dependencies.createCustomerKey ?? randomUUID,
        now: dependencies.now ?? (() => new Date()),
      });
      return createBillingJsonResponse(intent, 201);
    } catch {
      return createBillingJsonResponse(
        { code: 'BILLING_UNAVAILABLE', message: '결제 등록을 시작할 수 없습니다.' },
        503
      );
    }
  };
}
