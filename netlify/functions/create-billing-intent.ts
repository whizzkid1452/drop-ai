import type { Config } from '@netlify/functions';
import { createBillingRuntime } from '../billing-runtime';
import { createBillingIntentHandler } from '../../src/layers/billing/server/create-billing-intent-handler';

type BillingIntentHandler = (request: Request) => Promise<Response>;
let billingIntentHandler: BillingIntentHandler | undefined;

function getBillingIntentHandler(): BillingIntentHandler {
  if (billingIntentHandler) {
    return billingIntentHandler;
  }

  const runtime = createBillingRuntime();
  billingIntentHandler = createBillingIntentHandler({
    verifyAccessToken: runtime.verifyAccessToken,
    saveAuthorizationIntent: runtime.store.saveAuthorizationIntent,
    clientKey: runtime.environment.TOSS_CLIENT_KEY,
    amountKrw: runtime.environment.PRO_MONTHLY_PRICE_KRW,
    siteUrl: runtime.environment.URL,
  });
  return billingIntentHandler;
}

export default async function createIntent(request: Request): Promise<Response> {
  try {
    return await getBillingIntentHandler()(request);
  } catch {
    return Response.json(
      { code: 'SERVER_CONFIGURATION_ERROR', message: '결제 서버가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }
}

export const config: Config = {
  path: '/api/billing/intents',
};
