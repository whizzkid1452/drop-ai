import { useAccountEntitlementQuery } from '@/layers/apps/web/billing/billing-queries';
import { useAuthSnapshot } from '@/layers/apps/web/context/layer-hooks';
import { hasActiveProEntitlement } from '@/layers/billing/account-entitlement';
import { WebLLMPreloader } from './web-llm-preloader';

export function ProWebLLMPreloader() {
  const authSnapshot = useAuthSnapshot();
  const entitlementQuery = useAccountEntitlementQuery();

  if (authSnapshot.status === 'unavailable') {
    return <WebLLMPreloader />;
  }

  if (
    authSnapshot.status === 'authenticated' &&
    entitlementQuery.data &&
    hasActiveProEntitlement(entitlementQuery.data)
  ) {
    return <WebLLMPreloader />;
  }

  return null;
}
