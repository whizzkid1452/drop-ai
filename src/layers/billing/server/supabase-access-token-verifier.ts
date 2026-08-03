import { createClient } from '@supabase/supabase-js';
import type { AccessTokenVerifier } from './billing-http';

const SERVER_AUTH_OPTIONS = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

export function createSupabaseAccessTokenVerifier(supabaseUrl: string, publishableKey: string): AccessTokenVerifier {
  const authClient = createClient(supabaseUrl, publishableKey, SERVER_AUTH_OPTIONS);
  return async accessToken => {
    const { data, error } = await authClient.auth.getUser(accessToken);
    if (error || !data.user) {
      return null;
    }
    return { userId: data.user.id };
  };
}
