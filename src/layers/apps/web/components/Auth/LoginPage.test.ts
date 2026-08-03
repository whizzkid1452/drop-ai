// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

const authMocks = vi.hoisted(() => ({
  signInWithMagicLink: vi.fn().mockResolvedValue(undefined),
  snapshot: { status: 'anonymous' as const, user: null },
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAuthClient: () => ({ signInWithMagicLink: authMocks.signInWithMagicLink }),
  useAuthSnapshot: () => authMocks.snapshot,
}));

vi.mock('./LoginPage.css.ts', () => ({
  page: 'page',
  panel: 'panel',
  brand: 'brand',
  title: 'title',
  description: 'description',
  form: 'form',
  label: 'label',
  input: 'input',
  submitButton: 'submitButton',
  statusMessage: 'statusMessage',
  errorMessage: 'errorMessage',
  backLink: 'backLink',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderLoginPage(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(MemoryRouter, null, createElement(LoginPage))));
  return host;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  authMocks.signInWithMagicLink.mockClear();
});

describe('LoginPage', () => {
  it('입력한 이메일로 Magic Link를 요청한다', async () => {
    const host = renderLoginPage();
    const input = host.querySelector('input[type="email"]');
    const form = host.querySelector('form');

    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(form).toBeInstanceOf(HTMLFormElement);

    await act(async () => {
      setInputValue(input as HTMLInputElement, 'user@example.com');
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(authMocks.signInWithMagicLink).toHaveBeenCalledWith({
      email: 'user@example.com',
      callbackUrl: 'http://localhost:3000/auth/callback',
    });
    expect(host.textContent).toContain('이메일을 확인해주세요');
  });
});
