import { describe, expect, it } from 'vitest';
import { createAuthCallbackUrl } from './create-auth-callback-url';

describe('createAuthCallbackUrl', () => {
  it('루트에 배포된 앱의 callback URL을 만든다', () => {
    expect(createAuthCallbackUrl({ origin: 'https://drop.example.com', basePath: '/' })).toBe(
      'https://drop.example.com/auth/callback'
    );
  });

  it('하위 경로에 배포된 앱의 base path를 보존한다', () => {
    expect(createAuthCallbackUrl({ origin: 'https://drop.example.com', basePath: '/studio/' })).toBe(
      'https://drop.example.com/studio/auth/callback'
    );
  });
});
