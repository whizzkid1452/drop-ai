import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { BillingProviderError } from './billing-renewal-worker';

interface TossBillingGatewayConfig {
  readonly secretKey: string;
  readonly fetch: typeof fetch;
}

interface IssueBillingKeyRequest {
  readonly authKey: string;
  readonly customerKey: string;
  readonly idempotencyKey: string;
}

interface ChargeBillingKeyRequest {
  readonly amountKrw: number;
  readonly billingKey: string;
  readonly customerKey: string;
  readonly idempotencyKey: string;
  readonly orderId: string;
  readonly orderName: string;
}

const billingResponseSchema = z.object({
  billingKey: z.string().min(1),
  card: z
    .object({
      issuerCode: z.string().nullable().optional(),
      number: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const paymentResponseSchema = z.object({
  paymentKey: z.string().min(1),
  approvedAt: z.string().datetime({ offset: true }),
});

const providerErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().optional(),
});

const TOSS_API_ORIGIN = 'https://api.tosspayments.com';
const TOSS_REQUEST_TIMEOUT_MS = 65_000;

export function createTossBillingGateway({ secretKey, fetch }: TossBillingGatewayConfig) {
  const authorization = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

  async function requestJson(
    path: string,
    init: RequestInit,
    idempotencyKey?: string,
    hasResponseBody = true
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${TOSS_API_ORIGIN}${path}`, {
        ...init,
        headers: {
          authorization,
          'content-type': 'application/json',
          ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
          ...init.headers,
        },
        signal: AbortSignal.timeout(TOSS_REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new BillingProviderError('UNKNOWN_RESULT', true);
    }

    if (!response.ok) {
      const parsedError = providerErrorSchema.safeParse(await response.json());
      const errorCode = parsedError.success ? parsedError.data.code : 'UNKNOWN_PROVIDER_ERROR';
      const isRetryable = response.status >= 500 || response.status === 409;
      throw new BillingProviderError(errorCode, isRetryable);
    }

    return hasResponseBody ? response.json() : undefined;
  }

  return {
    issueBillingKey: async ({ authKey, customerKey, idempotencyKey }: IssueBillingKeyRequest) => {
      const response = await requestJson(
        '/v1/billing/authorizations/issue',
        {
          method: 'POST',
          body: JSON.stringify({ authKey, customerKey }),
        },
        idempotencyKey
      );
      const parsed = billingResponseSchema.safeParse(response);
      if (!parsed.success) {
        throw new BillingProviderError('INVALID_PROVIDER_RESPONSE', true);
      }

      return {
        billingKey: parsed.data.billingKey,
        cardIssuerCode: parsed.data.card?.issuerCode ?? null,
        cardNumber: parsed.data.card?.number ?? null,
      };
    },
    chargeBillingKey: async ({
      amountKrw,
      billingKey,
      customerKey,
      idempotencyKey,
      orderId,
      orderName,
    }: ChargeBillingKeyRequest) => {
      const response = await requestJson(
        `/v1/billing/${encodeURIComponent(billingKey)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: amountKrw,
            customerKey,
            orderId,
            orderName,
          }),
        },
        idempotencyKey
      );
      const parsed = paymentResponseSchema.safeParse(response);
      if (!parsed.success) {
        throw new BillingProviderError('INVALID_PROVIDER_RESPONSE', true);
      }
      return parsed.data;
    },
    deleteBillingKey: async (billingKey: string): Promise<void> => {
      await requestJson(`/v1/billing/${encodeURIComponent(billingKey)}`, { method: 'DELETE' }, undefined, false);
    },
  };
}
