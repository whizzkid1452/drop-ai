import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { accountEntitlementSchema } from '../account-entitlement';
import type { AccountEntitlementDependencies } from './account-entitlement-handler';

interface SupabaseAccountEntitlementConfig {
  readonly supabaseUrl: string;
  readonly publishableKey: string;
  readonly secretKey: string;
}

const accountEntitlementRowSchema = z.object({
  plan_code: z.enum(['free', 'pro']),
  status: z.enum(['active', 'past_due']),
  current_period_end: z.string().datetime({ offset: true }).nullable(),
});

const SERVER_AUTH_OPTIONS = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

export function createSupabaseAccountEntitlementDependencies({
  supabaseUrl,
  publishableKey,
  secretKey,
}: SupabaseAccountEntitlementConfig): AccountEntitlementDependencies {
  const authClient = createClient(supabaseUrl, publishableKey, SERVER_AUTH_OPTIONS);
  const dataClient = createClient(supabaseUrl, secretKey, SERVER_AUTH_OPTIONS);

  return {
    verifyAccessToken: async accessToken => {
      const { data, error } = await authClient.auth.getUser(accessToken);
      if (error || !data.user) {
        return null;
      }
      return { userId: data.user.id };
    },
    readAccountEntitlement: async userId => {
      const { data, error } = await dataClient
        .from('account_entitlements')
        .select('plan_code, status, current_period_end')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw new Error('계정 권한 저장소 조회에 실패했습니다.');
      }
      if (!data) {
        return null;
      }

      const row = accountEntitlementRowSchema.parse(data);
      return accountEntitlementSchema.parse({
        planCode: row.plan_code,
        status: row.status,
        currentPeriodEnd: row.current_period_end,
      });
    },
  };
}
