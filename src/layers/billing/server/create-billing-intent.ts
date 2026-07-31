interface BillingIntentResult {
  readonly clientKey: string;
  readonly customerKey: string;
  readonly amountKrw: number;
  readonly successUrl: string;
  readonly failUrl: string;
}

export interface CreateBillingIntentDependencies {
  createCustomerKey(): string;
  saveAuthorizationIntent(request: {
    readonly userId: string;
    readonly customerKey: string;
    readonly amountKrw: number;
    readonly expiresAt: string;
  }): Promise<void>;
  now(): Date;
  readonly clientKey: string;
  readonly amountKrw: number;
  readonly siteUrl: string;
}

const BILLING_INTENT_DURATION_MS = 15 * 60 * 1_000;

export async function createBillingIntent(
  userId: string,
  dependencies: CreateBillingIntentDependencies
): Promise<BillingIntentResult> {
  const customerKey = dependencies.createCustomerKey();
  const expiresAt = new Date(dependencies.now().getTime() + BILLING_INTENT_DURATION_MS);
  await dependencies.saveAuthorizationIntent({
    userId,
    customerKey,
    amountKrw: dependencies.amountKrw,
    expiresAt: expiresAt.toISOString(),
  });

  const siteUrl = new URL(dependencies.siteUrl);
  return {
    clientKey: dependencies.clientKey,
    customerKey,
    amountKrw: dependencies.amountKrw,
    successUrl: new URL('/billing/success', siteUrl).toString(),
    failUrl: new URL('/billing/fail', siteUrl).toString(),
  };
}
