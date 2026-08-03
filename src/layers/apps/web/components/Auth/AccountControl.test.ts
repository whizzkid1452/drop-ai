// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthSnapshot } from '@/layers/auth/i-auth-client';
import { AccountControl } from './AccountControl';

const authMocks = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue(undefined),
  snapshot: { status: 'anonymous', user: null } as AuthSnapshot,
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAuthClient: () => ({ signOut: authMocks.signOut }),
  useAuthSnapshot: () => authMocks.snapshot,
}));

vi.mock('./AccountControl.css.ts', () => ({
  container: 'container',
  email: 'email',
  action: 'action',
  error: 'error',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderAccountControl(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(MemoryRouter, null, createElement(AccountControl))));
  return host;
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  authMocks.snapshot = { status: 'anonymous', user: null };
  authMocks.signOut.mockClear();
});

describe('AccountControl', () => {
  it('로그아웃 상태에서 로그인 경로를 제공한다', () => {
    const host = renderAccountControl();
    const loginLink = host.querySelector('a');

    expect(loginLink?.getAttribute('href')).toBe('/login');
    expect(loginLink?.textContent).toBe('LOG IN');
  });

  it('로그인 사용자의 이메일과 로그아웃 동작을 제공한다', async () => {
    authMocks.snapshot = {
      status: 'authenticated',
      user: { id: 'user-1', email: 'user@example.com' },
    };
    const host = renderAccountControl();
    const signOutButton = host.querySelector('button');
    const billingLink = host.querySelector('a');

    expect(host.textContent).toContain('user@example.com');
    expect(billingLink?.getAttribute('href')).toBe('/billing');
    expect(billingLink?.textContent).toBe('PRO');

    await act(async () => signOutButton?.click());

    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
  });
});
