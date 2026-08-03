import { describe, expect, it, vi } from 'vitest';
import { SupabaseAuthClient, type SupabaseAuthPort, type SupabaseSession } from './supabase-auth-client';

interface AuthPortHarness {
  readonly authPort: SupabaseAuthPort;
  emitSession(session: SupabaseSession | null): void;
}

function createAuthPortHarness(): AuthPortHarness {
  let authStateListener: ((session: SupabaseSession | null) => void) | undefined;
  const authPort: SupabaseAuthPort = {
    onAuthStateChange: listener => {
      authStateListener = listener;
    },
    signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };

  return {
    authPort,
    emitSession: session => authStateListener?.(session),
  };
}

describe('SupabaseAuthClient', () => {
  it('초기 인증 결과를 받기 전에는 loading 상태를 유지한다', () => {
    const { authPort } = createAuthPortHarness();
    const authClient = new SupabaseAuthClient(authPort);

    expect(authClient.getSnapshot()).toEqual({ status: 'loading', user: null });
  });

  it('Supabase 인증 상태 변경을 읽기 전용 사용자 상태로 변환한다', () => {
    const { authPort, emitSession } = createAuthPortHarness();
    const authClient = new SupabaseAuthClient(authPort);
    const listener = vi.fn();
    authClient.subscribe(listener);

    emitSession(null);
    expect(authClient.getSnapshot()).toEqual({ status: 'anonymous', user: null });

    emitSession({ access_token: 'access-token-1', user: { id: 'user-1', email: 'user@example.com' } });
    expect(authClient.getSnapshot()).toEqual({
      status: 'authenticated',
      user: { id: 'user-1', email: 'user@example.com' },
    });
    expect(authClient.getAccessToken()).toBe('access-token-1');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('로그아웃 상태로 바뀌면 서버 요청용 access token을 제거한다', () => {
    const { authPort, emitSession } = createAuthPortHarness();
    const authClient = new SupabaseAuthClient(authPort);

    emitSession({ access_token: 'access-token-1', user: { id: 'user-1' } });
    emitSession(null);

    expect(authClient.getAccessToken()).toBeNull();
  });

  it('Magic Link 요청에 이메일과 callback URL을 전달한다', async () => {
    const { authPort } = createAuthPortHarness();
    const authClient = new SupabaseAuthClient(authPort);

    await authClient.signInWithMagicLink({
      email: 'user@example.com',
      callbackUrl: 'https://drop.example.com/auth/callback',
    });

    expect(authPort.signInWithOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: { emailRedirectTo: 'https://drop.example.com/auth/callback' },
    });
  });

  it('Supabase 로그인 오류를 호출자에게 전달한다', async () => {
    const { authPort } = createAuthPortHarness();
    vi.mocked(authPort.signInWithOtp).mockResolvedValue({ error: new Error('로그인 요청 실패') });
    const authClient = new SupabaseAuthClient(authPort);

    await expect(
      authClient.signInWithMagicLink({
        email: 'user@example.com',
        callbackUrl: 'https://drop.example.com/auth/callback',
      })
    ).rejects.toThrow('로그인 요청 실패');
  });
});
