import type { Config } from '@netlify/functions';
import { createBillingRuntime } from '../billing-runtime';
import { createCancelBillingHandler } from '../../src/layers/billing/server/cancel-billing-handler';

type CancelBillingHandler = (request: Request) => Promise<Response>;
let cancelBillingHandler: CancelBillingHandler | undefined;

function getCancelBillingHandler(): CancelBillingHandler {
  if (cancelBillingHandler) {
    return cancelBillingHandler;
  }

  const runtime = createBillingRuntime();
  cancelBillingHandler = createCancelBillingHandler({
    verifyAccessToken: runtime.verifyAccessToken,
    scheduleCancellation: runtime.store.scheduleCancellation,
    dispatchBillingWorker: runtime.dispatchBillingWorker,
  });
  return cancelBillingHandler;
}

export default async function cancelSubscription(request: Request): Promise<Response> {
  try {
    return await getCancelBillingHandler()(request);
  } catch {
    return Response.json(
      { code: 'SERVER_CONFIGURATION_ERROR', message: '결제 서버가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }
}

export const config: Config = {
  path: '/api/billing/cancel',
};
