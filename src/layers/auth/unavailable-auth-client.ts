import type { AuthSnapshot, IAuthClient } from './i-auth-client';

const UNAVAILABLE_AUTH_SNAPSHOT: AuthSnapshot = { status: 'unavailable', user: null };

export class UnavailableAuthClient implements IAuthClient {
  getSnapshot = (): AuthSnapshot => UNAVAILABLE_AUTH_SNAPSHOT;

  getAccessToken = (): null => null;

  subscribe = (): (() => void) => () => undefined;

  async signInWithMagicLink(): Promise<void> {
    throw new Error('로그인 서비스가 설정되지 않았습니다.');
  }

  async signOut(): Promise<void> {
    throw new Error('로그인 서비스가 설정되지 않았습니다.');
  }
}
