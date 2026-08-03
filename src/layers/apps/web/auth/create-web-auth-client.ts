import { createClient } from '@supabase/supabase-js';
import type { IAuthClient } from '@/layers/auth/i-auth-client';
import { SupabaseAuthClient, type SupabaseAuthPort } from '@/layers/auth/supabase-auth-client';
import { UnavailableAuthClient } from '@/layers/auth/unavailable-auth-client';

interface WebAuthEnvironment {
  readonly supabaseUrl?: string;
  readonly supabasePublishableKey?: string;
}

function hasSupabaseConfiguration(environment: WebAuthEnvironment): environment is Required<WebAuthEnvironment> {
  return Boolean(environment.supabaseUrl?.trim() && environment.supabasePublishableKey?.trim());
}

export function createWebAuthClient(environment: WebAuthEnvironment): IAuthClient {
  if (!hasSupabaseConfiguration(environment)) {
    // 인증 설정이 없어도 브라우저의 로컬 오디오 편집 기능은 유지한다.
    return new UnavailableAuthClient();
  }

  const supabaseClient = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
  const authPort: SupabaseAuthPort = {
    onAuthStateChange: listener => {
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        // Supabase 객체가 UI 계층으로 퍼지지 않도록 필요한 사용자 식별 정보만 전달한다.
        listener(session ? { user: { id: session.user.id, email: session.user.email } } : null);
      });
    },
    signInWithOtp: async request => {
      const { error } = await supabaseClient.auth.signInWithOtp(request);
      return { error };
    },
    signOut: async () => {
      const { error } = await supabaseClient.auth.signOut();
      return { error };
    },
  };

  return new SupabaseAuthClient(authPort);
}
