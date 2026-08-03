import { z } from 'zod';
import { createBillingKeyCipher } from '../src/layers/billing/server/billing-key-cipher';
import { createSupabaseAccessTokenVerifier } from '../src/layers/billing/server/supabase-access-token-verifier';
import { createSupabaseBillingStore } from '../src/layers/billing/server/supabase-billing-store';
import { createTossBillingGateway } from '../src/layers/billing/server/toss-billing-gateway';

const billingEnvironmentSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  TOSS_CLIENT_KEY: z.string().min(1),
  TOSS_SECRET_KEY: z.string().min(1),
  PRO_MONTHLY_PRICE_KRW: z.coerce.number().int().positive(),
  BILLING_KEY_ENCRYPTION_KEY: z.string().min(1),
  BILLING_JOB_SECRET: z.string().min(32),
  URL: z.string().url(),
});

export function createBillingRuntime() {
  const environment = billingEnvironmentSchema.parse(process.env);
  const billingKeyCipher = createBillingKeyCipher(environment.BILLING_KEY_ENCRYPTION_KEY);
  const store = createSupabaseBillingStore({
    supabaseUrl: environment.SUPABASE_URL,
    secretKey: environment.SUPABASE_SECRET_KEY,
    billingKeyCipher,
  });
  const gateway = createTossBillingGateway({
    secretKey: environment.TOSS_SECRET_KEY,
    fetch,
  });

  return {
    environment,
    store,
    gateway,
    verifyAccessToken: createSupabaseAccessTokenVerifier(
      environment.SUPABASE_URL,
      environment.SUPABASE_PUBLISHABLE_KEY
    ),
    dispatchBillingWorker: () =>
      dispatchBillingWorker({
        siteUrl: environment.URL,
        jobSecret: environment.BILLING_JOB_SECRET,
      }),
  };
}

export async function dispatchBillingWorker(request: {
  readonly siteUrl: string;
  readonly jobSecret: string;
}): Promise<void> {
  const response = await fetch(new URL('/.netlify/functions/process-billing-background', request.siteUrl), {
    method: 'POST',
    headers: { authorization: `Bearer ${request.jobSecret}` },
  });
  if (!response.ok) {
    throw new Error('결제 worker 호출에 실패했습니다.');
  }
}
