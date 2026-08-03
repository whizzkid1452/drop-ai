import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import type { IAuthClient } from '@/layers/auth/i-auth-client';
import type { IBillingClient } from '@/layers/billing/i-billing-client';
import { BrowserBillingClient } from './browser-billing-client';

export function createWebBillingClient(authClient: IAuthClient): IBillingClient {
  return new BrowserBillingClient({
    getAccessToken: authClient.getAccessToken,
    fetch,
    loadTossPayments,
  });
}
