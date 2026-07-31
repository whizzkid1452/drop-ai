import { timingSafeEqual } from 'node:crypto';
import type { Config } from '@netlify/functions';
import { createBillingRuntime } from '../billing-runtime';
import { runBillingRenewalWorker } from '../../src/layers/billing/server/billing-renewal-worker';

function hasValidJobSecret(request: Request, expectedSecret: string): boolean {
  const suppliedSecret = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const suppliedBuffer = Buffer.from(suppliedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export default async function processBilling(request: Request): Promise<Response> {
  try {
    const runtime = createBillingRuntime();
    if (!hasValidJobSecret(request, runtime.environment.BILLING_JOB_SECRET)) {
      return new Response(null, { status: 401 });
    }

    await runBillingRenewalWorker({
      ...runtime.store,
      chargeBillingKey: runtime.gateway.chargeBillingKey,
      deleteBillingKey: runtime.gateway.deleteBillingKey,
    });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}

export const config: Config = {
  background: true,
};
