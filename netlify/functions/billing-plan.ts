import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { createBillingPlanHandler } from '../../src/layers/billing/server/billing-plan-handler';

const planEnvironmentSchema = z.object({
  PRO_MONTHLY_PRICE_KRW: z.coerce.number().int().positive(),
});

type BillingPlanHandler = (request: Request) => Promise<Response>;
let billingPlanHandler: BillingPlanHandler | undefined;

function getBillingPlanHandler(): BillingPlanHandler {
  if (billingPlanHandler) {
    return billingPlanHandler;
  }

  const environment = planEnvironmentSchema.parse(process.env);
  billingPlanHandler = createBillingPlanHandler(environment.PRO_MONTHLY_PRICE_KRW);
  return billingPlanHandler;
}

export default async function readBillingPlan(request: Request): Promise<Response> {
  try {
    return await getBillingPlanHandler()(request);
  } catch {
    return Response.json(
      { code: 'SERVER_CONFIGURATION_ERROR', message: '결제 서버가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }
}

export const config: Config = {
  path: '/api/billing/plan',
};
