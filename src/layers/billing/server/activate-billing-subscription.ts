export interface BillingAuthorizationIntent {
  readonly id: string;
  readonly amountKrw: number;
  readonly completedAt: string | null;
  readonly expiresAt: string;
}

interface IssuedBillingKey {
  readonly billingKey: string;
  readonly cardIssuerCode: string | null;
  readonly cardNumber: string | null;
}

interface ActivateBillingRequest {
  readonly userId: string;
  readonly customerKey: string;
  readonly authKey: string;
}

export interface ActivateBillingDependencies {
  findAuthorizationIntent(request: {
    readonly userId: string;
    readonly customerKey: string;
  }): Promise<BillingAuthorizationIntent | null>;
  issueBillingKey(request: {
    readonly authKey: string;
    readonly customerKey: string;
    readonly idempotencyKey: string;
  }): Promise<IssuedBillingKey>;
  saveIssuedBillingKey(request: {
    readonly userId: string;
    readonly customerKey: string;
    readonly billingKey: string;
    readonly cardIssuerCode: string | null;
    readonly cardNumber: string | null;
  }): Promise<void>;
  dispatchBillingWorker(): Promise<void>;
  now(): Date;
}

export class BillingActivationError extends Error {
  constructor(readonly code: 'INVALID_BILLING_INTENT' | 'EXPIRED_BILLING_INTENT') {
    super(code);
  }
}

export async function activateBillingSubscription(
  { userId, customerKey, authKey }: ActivateBillingRequest,
  dependencies: ActivateBillingDependencies
): Promise<{ readonly status: 'pending' }> {
  const intent = await dependencies.findAuthorizationIntent({ userId, customerKey });
  if (!intent) {
    throw new BillingActivationError('INVALID_BILLING_INTENT');
  }
  if (intent.completedAt) {
    await dispatchWorkerWithoutBlockingActivation(dependencies);
    return { status: 'pending' };
  }
  if (new Date(intent.expiresAt).getTime() <= dependencies.now().getTime()) {
    throw new BillingActivationError('EXPIRED_BILLING_INTENT');
  }

  const billing = await dependencies.issueBillingKey({
    authKey,
    customerKey,
    idempotencyKey: `billing-intent-${intent.id}`,
  });
  await dependencies.saveIssuedBillingKey({
    userId,
    customerKey,
    billingKey: billing.billingKey,
    cardIssuerCode: billing.cardIssuerCode,
    cardNumber: billing.cardNumber,
  });
  await dispatchWorkerWithoutBlockingActivation(dependencies);
  return { status: 'pending' };
}

async function dispatchWorkerWithoutBlockingActivation(dependencies: ActivateBillingDependencies): Promise<void> {
  try {
    await dependencies.dispatchBillingWorker();
  } catch {
    // 저장된 pending 구독은 정기 worker가 다시 처리하므로 카드 등록 결과를 되돌리지 않는다.
  }
}
