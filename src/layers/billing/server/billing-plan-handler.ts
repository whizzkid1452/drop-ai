import { createBillingJsonResponse } from './billing-http';

export function createBillingPlanHandler(amountKrw: number): (request: Request) => Promise<Response> {
  return async request => {
    if (request.method !== 'GET') {
      return createBillingJsonResponse({ code: 'METHOD_NOT_ALLOWED', message: '지원하지 않는 요청입니다.' }, 405);
    }

    return createBillingJsonResponse({
      planCode: 'pro',
      amountKrw,
      currency: 'KRW',
      interval: 'month',
    });
  };
}
