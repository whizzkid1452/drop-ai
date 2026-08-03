import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { BillingAuthorizationIntent } from './activate-billing-subscription';
import type { BillingSubscriptionSummary } from './billing-subscription-handler';
import type { BillingRenewalWorkerDependencies, DueBillingSubscription } from './billing-renewal-worker';

interface BillingKeyCipher {
  encrypt(billingKey: string): string;
  decrypt(encryptedBillingKey: string): string;
}

interface SupabaseBillingStoreConfig {
  readonly supabaseUrl: string;
  readonly secretKey: string;
  readonly billingKeyCipher: BillingKeyCipher;
}

const authorizationIntentRowSchema = z.object({
  id: z.string().uuid(),
  amount_krw: z.number().int().positive(),
  completed_at: z.string().datetime({ offset: true }).nullable(),
  expires_at: z.string().datetime({ offset: true }),
});

const dueSubscriptionRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  customer_key: z.string().min(2),
  billing_key_ciphertext: z.string().min(1),
  status: z.enum(['pending', 'active', 'cancel_at_period_end']),
  amount_krw: z.number().int().positive(),
  charge_sequence: z.number().int().nonnegative(),
  billing_anchor_day: z.number().int().min(1).max(31),
  current_period_end: z.string().datetime({ offset: true }).nullable(),
});

const billingOrderRowSchema = z.object({
  provider_order_id: z.string().min(6),
  idempotency_key: z.string().min(6),
});

const billingSubscriptionSummaryRowSchema = z.object({
  status: z.enum(['pending', 'active', 'cancel_at_period_end', 'past_due', 'canceled']),
  amount_krw: z.number().int().positive(),
  current_period_end: z.string().datetime({ offset: true }).nullable(),
  card_last_four: z.string().length(4).nullable(),
});

const SERVER_AUTH_OPTIONS = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

export function createSupabaseBillingStore({ supabaseUrl, secretKey, billingKeyCipher }: SupabaseBillingStoreConfig) {
  const dataClient = createClient(supabaseUrl, secretKey, SERVER_AUTH_OPTIONS);

  async function saveAuthorizationIntent(request: {
    readonly userId: string;
    readonly customerKey: string;
    readonly amountKrw: number;
    readonly expiresAt: string;
  }): Promise<void> {
    const { error } = await dataClient.rpc('create_billing_authorization_intent', {
      p_user_id: request.userId,
      p_customer_key: request.customerKey,
      p_amount_krw: request.amountKrw,
      p_expires_at: request.expiresAt,
    });
    throwOnStoreError(error);
  }

  async function findAuthorizationIntent(request: {
    readonly userId: string;
    readonly customerKey: string;
  }): Promise<BillingAuthorizationIntent | null> {
    const { data, error } = await dataClient
      .from('billing_authorization_intents')
      .select('id, amount_krw, completed_at, expires_at')
      .eq('user_id', request.userId)
      .eq('customer_key', request.customerKey)
      .maybeSingle();
    throwOnStoreError(error);
    if (!data) {
      return null;
    }

    const row = authorizationIntentRowSchema.parse(data);
    return {
      id: row.id,
      amountKrw: row.amount_krw,
      completedAt: row.completed_at,
      expiresAt: row.expires_at,
    };
  }

  async function saveIssuedBillingKey(request: {
    readonly userId: string;
    readonly customerKey: string;
    readonly billingKey: string;
    readonly cardIssuerCode: string | null;
    readonly cardNumber: string | null;
  }): Promise<void> {
    const { error } = await dataClient.rpc('complete_billing_authorization', {
      p_user_id: request.userId,
      p_customer_key: request.customerKey,
      p_billing_key_ciphertext: billingKeyCipher.encrypt(request.billingKey),
      p_card_issuer_code: request.cardIssuerCode,
      p_card_last_four: readLastFourDigits(request.cardNumber),
    });
    throwOnStoreError(error);
  }

  async function claimDueSubscriptions(limit: number): Promise<DueBillingSubscription[]> {
    const { data, error } = await dataClient.rpc('claim_due_billing_subscriptions', {
      p_batch_size: limit,
    });
    throwOnStoreError(error);

    return z
      .array(dueSubscriptionRowSchema)
      .parse(data ?? [])
      .map(row => ({
        id: row.id,
        userId: row.user_id,
        customerKey: row.customer_key,
        billingKey: billingKeyCipher.decrypt(row.billing_key_ciphertext),
        status: row.status,
        amountKrw: row.amount_krw,
        chargeSequence: row.charge_sequence,
        billingAnchorDay: row.billing_anchor_day,
        currentPeriodEnd: row.current_period_end,
      }));
  }

  async function getOrCreateBillingOrder(subscription: DueBillingSubscription) {
    const orderId = createProviderOrderId(subscription);
    const { error: insertError } = await dataClient.from('billing_orders').upsert(
      {
        subscription_id: subscription.id,
        user_id: subscription.userId,
        charge_sequence: subscription.chargeSequence,
        provider_order_id: orderId,
        idempotency_key: orderId,
        amount_krw: subscription.amountKrw,
        status: 'processing',
      },
      {
        onConflict: 'subscription_id,charge_sequence',
        ignoreDuplicates: true,
      }
    );
    throwOnStoreError(insertError);

    const { data, error } = await dataClient
      .from('billing_orders')
      .select('provider_order_id, idempotency_key')
      .eq('subscription_id', subscription.id)
      .eq('charge_sequence', subscription.chargeSequence)
      .single();
    throwOnStoreError(error);
    const row = billingOrderRowSchema.parse(data);
    return { orderId: row.provider_order_id, idempotencyKey: row.idempotency_key };
  }

  const workerStore: Pick<
    BillingRenewalWorkerDependencies,
    | 'claimDueSubscriptions'
    | 'getOrCreateBillingOrder'
    | 'completeSuccessfulCharge'
    | 'markChargeFailed'
    | 'releaseBillingClaim'
    | 'completeCanceledSubscription'
  > = {
    claimDueSubscriptions,
    getOrCreateBillingOrder,
    completeSuccessfulCharge: async request => {
      const { error } = await dataClient.rpc('complete_billing_charge', {
        p_user_id: request.subscription.userId,
        p_charge_sequence: request.subscription.chargeSequence,
        p_provider_order_id: request.orderId,
        p_payment_key: request.paymentKey,
        p_approved_at: request.approvedAt,
        p_period_start: request.periodStart,
        p_period_end: request.periodEnd,
      });
      throwOnStoreError(error);
    },
    markChargeFailed: async request => {
      const { error } = await dataClient.rpc('fail_billing_charge', {
        p_user_id: request.userId,
        p_provider_order_id: request.orderId,
        p_provider_error_code: request.providerErrorCode,
      });
      throwOnStoreError(error);
    },
    releaseBillingClaim: async userId => {
      const { error } = await dataClient
        .from('billing_subscriptions')
        .update({ processing_started_at: null })
        .eq('user_id', userId);
      throwOnStoreError(error);
    },
    completeCanceledSubscription: async userId => {
      const { error } = await dataClient.rpc('complete_billing_cancellation', {
        p_user_id: userId,
      });
      throwOnStoreError(error);
    },
  };

  return {
    saveAuthorizationIntent,
    findAuthorizationIntent,
    saveIssuedBillingKey,
    ...workerStore,
    readBillingSubscription: async (userId: string): Promise<BillingSubscriptionSummary | null> => {
      const { data, error } = await dataClient
        .from('billing_subscriptions')
        .select('status, amount_krw, current_period_end, card_last_four')
        .eq('user_id', userId)
        .maybeSingle();
      throwOnStoreError(error);
      if (!data) {
        return null;
      }

      const row = billingSubscriptionSummaryRowSchema.parse(data);
      return {
        status: row.status,
        amountKrw: row.amount_krw,
        currentPeriodEnd: row.current_period_end,
        cardLastFour: row.card_last_four,
      };
    },
    scheduleCancellation: async (userId: string): Promise<boolean> => {
      const { data, error } = await dataClient.rpc('schedule_billing_cancellation', {
        p_user_id: userId,
      });
      throwOnStoreError(error);
      return data === true;
    },
  };
}

function createProviderOrderId(subscription: DueBillingSubscription): string {
  const compactSubscriptionId = subscription.id.replaceAll('-', '').slice(0, 24);
  return `drop_${compactSubscriptionId}_${subscription.chargeSequence}`;
}

function readLastFourDigits(cardNumber: string | null): string | null {
  const digits = cardNumber?.replace(/\D/g, '') ?? '';
  return digits.length >= 4 ? digits.slice(-4) : null;
}

function throwOnStoreError(error: { readonly message: string } | null): void {
  if (error) {
    throw new Error('결제 저장소 작업에 실패했습니다.');
  }
}
