import type { Config } from '@netlify/functions';
import { createBillingRuntime } from '../billing-runtime';
import { createActivateBillingHandler } from '../../src/layers/billing/server/activate-billing-handler';

type ActivateBillingHandler = (request: Request) => Promise<Response>;
let activateBillingHandler: ActivateBillingHandler | undefined;

function getActivateBillingHandler(): ActivateBillingHandler {
  if (activateBillingHandler) {
    return activateBillingHandler;
  }

  const runtime = createBillingRuntime();
  activateBillingHandler = createActivateBillingHandler({
    verifyAccessToken: runtime.verifyAccessToken,
    findAuthorizationIntent: runtime.store.findAuthorizationIntent,
    issueBillingKey: runtime.gateway.issueBillingKey,
    saveIssuedBillingKey: runtime.store.saveIssuedBillingKey,
    dispatchBillingWorker: runtime.dispatchBillingWorker,
    now: () => new Date(),
  });
  return activateBillingHandler;
}

export default async function activateSubscription(request: Request): Promise<Response> {
  try {
    return await getActivateBillingHandler()(request);
  } catch {
    return Response.json(
      { code: 'SERVER_CONFIGURATION_ERROR', message: '결제 서버가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }
}

export const config: Config = {
  path: '/api/billing/activate',
};
