import { z } from 'zod';
import {
  accountEntitlementSchema,
  billingIntentSchema,
  billingPlanSchema,
  billingSubscriptionSchema,
  type BillingActivationRequest,
  type BillingIntent,
  type BillingPlan,
  type BillingSubscription,
  type IBillingClient,
} from '@/layers/billing/i-billing-client';
import type { AccountEntitlement } from '@/layers/billing/account-entitlement';

interface BillingAuthorizationWindow {
  requestBillingAuth(request: {
    readonly method: 'CARD';
    readonly successUrl: string;
    readonly failUrl: string;
    readonly customerEmail?: string;
  }): Promise<void>;
}

interface TossPayments {
  payment(request: { readonly customerKey: string }): BillingAuthorizationWindow;
}

export interface TossPaymentsLoader {
  (clientKey: string): Promise<TossPayments>;
}

interface BrowserBillingClientDependencies {
  getAccessToken(): string | null;
  readonly fetch: typeof fetch;
  readonly loadTossPayments: TossPaymentsLoader;
}

const billingErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

const billingActivationSchema = z.object({
  status: z.literal('pending'),
});

const billingCancellationSchema = z.object({
  status: z.literal('cancel_at_period_end'),
});

export class BillingClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'BillingClientError';
  }
}

export class BrowserBillingClient implements IBillingClient {
  constructor(private readonly dependencies: BrowserBillingClientDependencies) {}

  readPlan(): Promise<BillingPlan> {
    return this.request('/api/billing/plan', billingPlanSchema, { method: 'GET' });
  }

  readSubscription(): Promise<BillingSubscription> {
    return this.request('/api/billing/subscription', billingSubscriptionSchema, { method: 'GET' }, true);
  }

  readAccountEntitlement(): Promise<AccountEntitlement> {
    return this.request('/api/account/entitlement', accountEntitlementSchema, { method: 'GET' }, true);
  }

  async requestBillingAuthorization(customerEmail?: string): Promise<void> {
    const intent = await this.createBillingIntent();
    const tossPayments = await this.dependencies.loadTossPayments(intent.clientKey);
    const payment = tossPayments.payment({ customerKey: intent.customerKey });

    await payment.requestBillingAuth({
      method: 'CARD',
      successUrl: intent.successUrl,
      failUrl: intent.failUrl,
      ...(customerEmail ? { customerEmail } : {}),
    });
  }

  async activateSubscription(request: BillingActivationRequest): Promise<void> {
    await this.request('/api/billing/activate', billingActivationSchema, this.createJsonRequest(request), true);
  }

  async cancelSubscription(): Promise<void> {
    await this.request('/api/billing/cancel', billingCancellationSchema, { method: 'POST' }, true);
  }

  private createBillingIntent(): Promise<BillingIntent> {
    return this.request('/api/billing/intents', billingIntentSchema, { method: 'POST' }, true);
  }

  private createJsonRequest(body: unknown): RequestInit {
    return {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    };
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    requestInit: RequestInit,
    requiresAuthentication = false
  ): Promise<T> {
    const headers = new Headers(requestInit.headers);
    headers.set('accept', 'application/json');

    if (requiresAuthentication) {
      const accessToken = this.dependencies.getAccessToken();
      if (!accessToken) {
        throw new BillingClientError('AUTH_REQUIRED', '로그인이 필요합니다.', 401);
      }
      headers.set('authorization', `Bearer ${accessToken}`);
    }

    const response = await this.dependencies.fetch(path, {
      ...requestInit,
      headers: Object.fromEntries(headers.entries()),
    });
    const responseBody: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const billingError = billingErrorSchema.safeParse(responseBody);
      throw new BillingClientError(
        billingError.success ? billingError.data.code : 'BILLING_UNAVAILABLE',
        billingError.success ? billingError.data.message : '결제 요청을 처리하지 못했습니다.',
        response.status
      );
    }

    const result = schema.safeParse(responseBody);
    if (!result.success) {
      throw new BillingClientError('INVALID_SERVER_RESPONSE', '결제 서버 응답이 올바르지 않습니다.', 502);
    }

    return result.data;
  }
}
