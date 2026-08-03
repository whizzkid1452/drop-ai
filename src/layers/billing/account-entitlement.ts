import { z } from 'zod';

export const accountEntitlementSchema = z.object({
  planCode: z.enum(['free', 'pro']),
  status: z.enum(['active', 'past_due']),
  currentPeriodEnd: z.string().datetime({ offset: true }).nullable(),
});

export type AccountEntitlement = z.infer<typeof accountEntitlementSchema>;

export const FREE_ACCOUNT_ENTITLEMENT: AccountEntitlement = {
  planCode: 'free',
  status: 'active',
  currentPeriodEnd: null,
};
