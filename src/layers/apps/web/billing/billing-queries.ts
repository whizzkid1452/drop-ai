import { useQuery } from '@tanstack/react-query';
import { useAuthSnapshot, useBillingClient } from '../context/layer-hooks';

const BILLING_STATUS_REFRESH_MS = 2_000;

export const billingQueryKeys = {
  plan: ['billing', 'plan'] as const,
  subscription: (userId: string) => ['billing', 'subscription', userId] as const,
  entitlement: (userId: string) => ['billing', 'entitlement', userId] as const,
};

export function useBillingPlanQuery() {
  const billingClient = useBillingClient();
  return useQuery({
    queryKey: billingQueryKeys.plan,
    queryFn: () => billingClient.readPlan(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useBillingSubscriptionQuery() {
  const authSnapshot = useAuthSnapshot();
  const billingClient = useBillingClient();
  const userId = authSnapshot.status === 'authenticated' ? authSnapshot.user.id : '';

  return useQuery({
    queryKey: billingQueryKeys.subscription(userId),
    queryFn: () => billingClient.readSubscription(),
    enabled: Boolean(userId),
    refetchInterval: query => (query.state.data?.status === 'pending' ? BILLING_STATUS_REFRESH_MS : false),
  });
}

export function useAccountEntitlementQuery() {
  const authSnapshot = useAuthSnapshot();
  const billingClient = useBillingClient();
  const userId = authSnapshot.status === 'authenticated' ? authSnapshot.user.id : '';

  return useQuery({
    queryKey: billingQueryKeys.entitlement(userId),
    queryFn: () => billingClient.readAccountEntitlement(),
    enabled: Boolean(userId),
  });
}
