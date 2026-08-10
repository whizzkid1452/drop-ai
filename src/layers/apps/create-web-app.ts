import { createWebAuthClient } from './web/auth/create-web-auth-client';
import { createWebBillingClient } from './web/billing/create-web-billing-client';
import { createWebProjectSyncService } from './web/project-sync/create-web-project-sync-service';
import { createApp, type AppInstance } from './create-app';

export function createWebApp(): AppInstance {
  const authClient = createWebAuthClient({
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });
  const billingClient = createWebBillingClient(authClient);

  return createApp({
    authClient,
    billingClient,
    createProjectSync: projectRepository =>
      createWebProjectSyncService({
        authClient,
        onlineEventSource: typeof window === 'undefined' ? undefined : window,
        projectRepository,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      }),
  });
}
