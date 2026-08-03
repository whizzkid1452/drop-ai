import type { BillingPlan, BillingSubscription, IBillingClient } from './i-billing-client';
import type { AccountEntitlement } from './account-entitlement';

const BILLING_UNAVAILABLE_MESSAGE = '결제 서비스를 사용할 수 없습니다.';

export class UnavailableBillingClient implements IBillingClient {
  readPlan(): Promise<BillingPlan> {
    return Promise.reject(new Error(BILLING_UNAVAILABLE_MESSAGE));
  }

  readSubscription(): Promise<BillingSubscription> {
    return Promise.reject(new Error(BILLING_UNAVAILABLE_MESSAGE));
  }

  readAccountEntitlement(): Promise<AccountEntitlement> {
    return Promise.reject(new Error(BILLING_UNAVAILABLE_MESSAGE));
  }

  requestBillingAuthorization(): Promise<void> {
    return Promise.reject(new Error(BILLING_UNAVAILABLE_MESSAGE));
  }

  activateSubscription(): Promise<void> {
    return Promise.reject(new Error(BILLING_UNAVAILABLE_MESSAGE));
  }

  cancelSubscription(): Promise<void> {
    return Promise.reject(new Error(BILLING_UNAVAILABLE_MESSAGE));
  }
}
