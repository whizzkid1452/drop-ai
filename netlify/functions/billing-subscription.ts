import type { Config } from '@netlify/functions';
import { createBillingRuntime } from '../billing-runtime';
import { createBillingSubscriptionHandler } from '../../src/layers/billing/server/billing-subscription-handler';

type BillingSubscriptionHandler = (request: Request) => Promise<Response>;
let billingSubscriptionHandler: BillingSubscriptionHandler | undefined;

function getBillingSubscriptionHandler(): BillingSubscriptionHandler {
  if (billingSubscriptionHandler) {
    return billingSubscriptionHandler;
  }

  const runtime = createBillingRuntime();
  billingSubscriptionHandler = createBillingSubscriptionHandler({
    verifyAccessToken: runtime.verifyAccessToken,
    readBillingSubscription: runtime.store.readBillingSubscription,
  });
  return billingSubscriptionHandler;
}

export default async function readSubscription(request: Request): Promise<Response> {
  try {
    return await getBillingSubscriptionHandler()(request);
  } catch {
    return Response.json(
      { code: 'SERVER_CONFIGURATION_ERROR', message: '결제 서버가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }
}

export const config: Config = {
  path: '/api/billing/subscription',
};
