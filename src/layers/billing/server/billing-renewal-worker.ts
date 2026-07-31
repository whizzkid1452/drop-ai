export type DueBillingSubscriptionStatus = 'pending' | 'active' | 'cancel_at_period_end';

export interface DueBillingSubscription {
  readonly id: string;
  readonly userId: string;
  readonly customerKey: string;
  readonly billingKey: string;
  readonly status: DueBillingSubscriptionStatus;
  readonly amountKrw: number;
  readonly chargeSequence: number;
  readonly billingAnchorDay: number;
  readonly currentPeriodEnd: string | null;
}

interface BillingOrder {
  readonly orderId: string;
  readonly idempotencyKey: string;
}

interface ApprovedBillingCharge {
  readonly paymentKey: string;
  readonly approvedAt: string;
}

export interface BillingRenewalWorkerDependencies {
  claimDueSubscriptions(limit: number): Promise<DueBillingSubscription[]>;
  getOrCreateBillingOrder(subscription: DueBillingSubscription): Promise<BillingOrder>;
  chargeBillingKey(request: {
    readonly amountKrw: number;
    readonly billingKey: string;
    readonly customerKey: string;
    readonly idempotencyKey: string;
    readonly orderId: string;
    readonly orderName: string;
  }): Promise<ApprovedBillingCharge>;
  completeSuccessfulCharge(request: {
    readonly subscription: DueBillingSubscription;
    readonly orderId: string;
    readonly paymentKey: string;
    readonly approvedAt: string;
    readonly periodStart: string;
    readonly periodEnd: string;
  }): Promise<void>;
  markChargeFailed(request: {
    readonly userId: string;
    readonly orderId: string;
    readonly providerErrorCode: string;
  }): Promise<void>;
  releaseBillingClaim(userId: string): Promise<void>;
  deleteBillingKey(billingKey: string): Promise<void>;
  completeCanceledSubscription(userId: string): Promise<void>;
}

export class BillingProviderError extends Error {
  constructor(
    readonly code: string,
    readonly isRetryable: boolean
  ) {
    super(code);
  }
}

const WORKER_BATCH_SIZE = 10;
const ORDER_NAME = 'Drop Pro 월간 구독';

export async function runBillingRenewalWorker(dependencies: BillingRenewalWorkerDependencies): Promise<void> {
  const subscriptions = await dependencies.claimDueSubscriptions(WORKER_BATCH_SIZE);
  await Promise.all(subscriptions.map(subscription => processSubscription(subscription, dependencies)));
}

async function processSubscription(
  subscription: DueBillingSubscription,
  dependencies: BillingRenewalWorkerDependencies
): Promise<void> {
  if (subscription.status === 'cancel_at_period_end') {
    await processCancellation(subscription, dependencies);
    return;
  }

  let order: BillingOrder | undefined;
  try {
    order = await dependencies.getOrCreateBillingOrder(subscription);
    const charge = await dependencies.chargeBillingKey({
      amountKrw: subscription.amountKrw,
      billingKey: subscription.billingKey,
      customerKey: subscription.customerKey,
      idempotencyKey: order.idempotencyKey,
      orderId: order.orderId,
      orderName: ORDER_NAME,
    });
    const periodStart = subscription.currentPeriodEnd ?? new Date(charge.approvedAt).toISOString();
    const periodEnd = addUtcMonthClamped(periodStart, subscription.billingAnchorDay);

    await dependencies.completeSuccessfulCharge({
      subscription,
      orderId: order.orderId,
      paymentKey: charge.paymentKey,
      approvedAt: charge.approvedAt,
      periodStart,
      periodEnd,
    });
  } catch (error) {
    if (error instanceof BillingProviderError && !error.isRetryable && order) {
      await dependencies.markChargeFailed({
        userId: subscription.userId,
        orderId: order.orderId,
        providerErrorCode: error.code,
      });
      return;
    }

    await dependencies.releaseBillingClaim(subscription.userId);
  }
}

async function processCancellation(
  subscription: DueBillingSubscription,
  dependencies: BillingRenewalWorkerDependencies
): Promise<void> {
  try {
    await dependencies.completeCanceledSubscription(subscription.userId);
  } catch {
    await dependencies.releaseBillingClaim(subscription.userId);
    return;
  }

  try {
    await dependencies.deleteBillingKey(subscription.billingKey);
  } catch {
    // DB에서 취소를 먼저 확정했으므로 빌링키 삭제 실패가 이후 결제를 다시 활성화하지 않는다.
  }
}

function addUtcMonthClamped(isoDate: string, anchorDay: number): string {
  const date = new Date(isoDate);
  const nextMonthStart = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
  const lastDayOfNextMonth = new Date(
    Date.UTC(nextMonthStart.getUTCFullYear(), nextMonthStart.getUTCMonth() + 1, 0)
  ).getUTCDate();
  nextMonthStart.setUTCDate(Math.min(anchorDay, lastDayOfNextMonth));
  return nextMonthStart.toISOString();
}
