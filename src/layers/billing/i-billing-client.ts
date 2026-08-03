import { z } from 'zod';
import { accountEntitlementSchema, type AccountEntitlement } from './account-entitlement';

export const billingPlanSchema = z.object({
  planCode: z.literal('pro'),
  amountKrw: z.number().int().positive(),
  currency: z.literal('KRW'),
  interval: z.literal('month'),
});

export const billingSubscriptionSchema = z.object({
  status: z.enum(['none', 'pending', 'active', 'cancel_at_period_end', 'past_due', 'canceled']),
  amountKrw: z.number().int().positive().nullable(),
  currentPeriodEnd: z.string().datetime({ offset: true }).nullable(),
  cardLastFour: z
    .string()
    .regex(/^\d{4}$/)
    .nullable(),
});

export const billingIntentSchema = z.object({
  clientKey: z.string().min(1),
  customerKey: z.string().min(2),
  amountKrw: z.number().int().positive(),
  successUrl: z.string().url(),
  failUrl: z.string().url(),
});

export type BillingPlan = z.infer<typeof billingPlanSchema>;
export type BillingSubscription = z.infer<typeof billingSubscriptionSchema>;
export type BillingIntent = z.infer<typeof billingIntentSchema>;

export interface BillingActivationRequest {
  readonly authKey: string;
  readonly customerKey: string;
}

export interface IBillingClient {
  readPlan(): Promise<BillingPlan>;
  readSubscription(): Promise<BillingSubscription>;
  readAccountEntitlement(): Promise<AccountEntitlement>;
  requestBillingAuthorization(customerEmail?: string): Promise<void>;
  activateSubscription(request: BillingActivationRequest): Promise<void>;
  cancelSubscription(): Promise<void>;
}

export { accountEntitlementSchema };
