import { describe, expect, it, vi } from 'vitest';
import {
  BillingProviderError,
  runBillingRenewalWorker,
  type BillingRenewalWorkerDependencies,
  type DueBillingSubscription,
} from './billing-renewal-worker';

const DUE_SUBSCRIPTION: DueBillingSubscription = {
  id: '49d04f42-ec1b-429c-896e-c9687638aca1',
  userId: 'user-1',
  customerKey: 'customer-key',
  billingKey: 'billing-key',
  status: 'pending',
  amountKrw: 12_000,
  chargeSequence: 0,
  billingAnchorDay: 31,
  currentPeriodEnd: null,
};

function createDependencies(
  overrides: Partial<BillingRenewalWorkerDependencies> = {}
): BillingRenewalWorkerDependencies {
  return {
    claimDueSubscriptions: vi.fn().mockResolvedValue([DUE_SUBSCRIPTION]),
    getOrCreateBillingOrder: vi.fn().mockResolvedValue({
      orderId: 'drop_49d04f42ec1b429c896ec968_0',
      idempotencyKey: 'drop_49d04f42ec1b429c896ec968_0',
    }),
    chargeBillingKey: vi.fn().mockResolvedValue({
      paymentKey: 'payment-key',
      approvedAt: '2026-07-31T17:00:00+09:00',
    }),
    completeSuccessfulCharge: vi.fn().mockResolvedValue(undefined),
    markChargeFailed: vi.fn().mockResolvedValue(undefined),
    releaseBillingClaim: vi.fn().mockResolvedValue(undefined),
    deleteBillingKey: vi.fn().mockResolvedValue(undefined),
    completeCanceledSubscription: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('runBillingRenewalWorker', () => {
  it('승인된 결제의 주문과 다음 월 결제일을 저장한다', async () => {
    const dependencies = createDependencies();

    await runBillingRenewalWorker(dependencies);

    expect(dependencies.chargeBillingKey).toHaveBeenCalledWith({
      amountKrw: 12_000,
      billingKey: 'billing-key',
      customerKey: 'customer-key',
      idempotencyKey: 'drop_49d04f42ec1b429c896ec968_0',
      orderId: 'drop_49d04f42ec1b429c896ec968_0',
      orderName: 'Drop Pro 월간 구독',
    });
    expect(dependencies.completeSuccessfulCharge).toHaveBeenCalledWith({
      subscription: DUE_SUBSCRIPTION,
      orderId: 'drop_49d04f42ec1b429c896ec968_0',
      paymentKey: 'payment-key',
      approvedAt: '2026-07-31T17:00:00+09:00',
      periodStart: '2026-07-31T08:00:00.000Z',
      periodEnd: '2026-08-31T08:00:00.000Z',
    });
  });

  it('기간 종료 취소 구독은 결제하지 않고 빌링키를 삭제한다', async () => {
    const canceledSubscription: DueBillingSubscription = {
      ...DUE_SUBSCRIPTION,
      status: 'cancel_at_period_end',
    };
    const dependencies = createDependencies({
      claimDueSubscriptions: vi.fn().mockResolvedValue([canceledSubscription]),
    });

    await runBillingRenewalWorker(dependencies);

    expect(dependencies.chargeBillingKey).not.toHaveBeenCalled();
    expect(dependencies.deleteBillingKey).toHaveBeenCalledWith('billing-key');
    expect(dependencies.completeCanceledSubscription).toHaveBeenCalledWith('user-1');
  });

  it('DB 취소 후 빌링키 삭제가 실패해도 구독을 다시 활성화하지 않는다', async () => {
    const dependencies = createDependencies({
      claimDueSubscriptions: vi.fn().mockResolvedValue([{ ...DUE_SUBSCRIPTION, status: 'cancel_at_period_end' }]),
      deleteBillingKey: vi.fn().mockRejectedValue(new Error('provider unavailable')),
    });

    await runBillingRenewalWorker(dependencies);

    expect(dependencies.completeCanceledSubscription).toHaveBeenCalledWith('user-1');
    expect(dependencies.releaseBillingClaim).not.toHaveBeenCalled();
  });

  it('명시적 결제 거절은 past_due 상태로 기록한다', async () => {
    const dependencies = createDependencies({
      chargeBillingKey: vi.fn().mockRejectedValue(new BillingProviderError('REJECT_CARD_COMPANY', false)),
    });

    await runBillingRenewalWorker(dependencies);

    expect(dependencies.markChargeFailed).toHaveBeenCalledWith({
      userId: 'user-1',
      orderId: 'drop_49d04f42ec1b429c896ec968_0',
      providerErrorCode: 'REJECT_CARD_COMPANY',
    });
    expect(dependencies.releaseBillingClaim).not.toHaveBeenCalled();
  });

  it('결제 결과가 불명확하면 같은 주문으로 재확인할 수 있게 claim만 해제한다', async () => {
    const dependencies = createDependencies({
      chargeBillingKey: vi.fn().mockRejectedValue(new BillingProviderError('UNKNOWN_RESULT', true)),
    });

    await runBillingRenewalWorker(dependencies);

    expect(dependencies.markChargeFailed).not.toHaveBeenCalled();
    expect(dependencies.releaseBillingClaim).toHaveBeenCalledWith('user-1');
  });
});
