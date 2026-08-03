import { createWebAuthClient } from './web/auth/create-web-auth-client';
import { createApp, type AppInstance } from './create-app';

export function createWebApp(): AppInstance {
  const authClient = createWebAuthClient({
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });

  return createApp({ authClient });
}
