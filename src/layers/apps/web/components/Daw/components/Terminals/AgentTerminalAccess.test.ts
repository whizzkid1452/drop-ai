// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthSnapshot } from '@/layers/auth/i-auth-client';
import type { AccountEntitlement } from '@/layers/billing/account-entitlement';
import { AgentTerminalAccess } from './AgentTerminalAccess';

const accessMocks = vi.hoisted(() => ({
  authSnapshot: { status: 'anonymous', user: null } as AuthSnapshot,
  entitlement: undefined as AccountEntitlement | undefined,
  isPending: false,
  isError: false,
  agentTerminal: vi.fn(() => createElement('div', null, 'AGENT TERMINAL')),
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAuthSnapshot: () => accessMocks.authSnapshot,
}));

vi.mock('@/layers/apps/web/billing/billing-queries', () => ({
  useAccountEntitlementQuery: () => ({
    data: accessMocks.entitlement,
    isPending: accessMocks.isPending,
    isError: accessMocks.isError,
    refetch: vi.fn(),
  }),
}));

vi.mock('./AgentTerminal/AgentTerminal', () => ({
  AgentTerminal: accessMocks.agentTerminal,
}));

vi.mock('./AgentTerminalAccess.css', () => ({
  container: 'container',
  badge: 'badge',
  title: 'title',
  description: 'description',
  action: 'action',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderAgentTerminalAccess(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(MemoryRouter, null, createElement(AgentTerminalAccess))));
  return host;
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  accessMocks.authSnapshot = { status: 'anonymous', user: null };
  accessMocks.entitlement = undefined;
  accessMocks.isPending = false;
  accessMocks.isError = false;
  accessMocks.agentTerminal.mockClear();
});

describe('AgentTerminalAccess', () => {
  it('인증 기능이 설정되지 않은 기존 로컬 환경에서는 Agent Terminal을 유지한다', () => {
    accessMocks.authSnapshot = { status: 'unavailable', user: null };

    renderAgentTerminalAccess();

    expect(accessMocks.agentTerminal).toHaveBeenCalledTimes(1);
  });

  it('로그아웃 사용자는 로그인 경로를 안내한다', () => {
    const host = renderAgentTerminalAccess();

    expect(accessMocks.agentTerminal).not.toHaveBeenCalled();
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/login');
  });

  it('유효한 Pro 권한이 있으면 Agent Terminal을 연다', () => {
    accessMocks.authSnapshot = {
      status: 'authenticated',
      user: { id: 'user-1', email: 'user@example.com' },
    };
    accessMocks.entitlement = {
      planCode: 'pro',
      status: 'active',
      currentPeriodEnd: '2099-08-31T00:00:00.000Z',
    };

    renderAgentTerminalAccess();

    expect(accessMocks.agentTerminal).toHaveBeenCalledTimes(1);
  });

  it('무료 사용자는 구독 경로를 안내한다', () => {
    accessMocks.authSnapshot = {
      status: 'authenticated',
      user: { id: 'user-1', email: 'user@example.com' },
    };
    accessMocks.entitlement = {
      planCode: 'free',
      status: 'active',
      currentPeriodEnd: null,
    };

    const host = renderAgentTerminalAccess();

    expect(accessMocks.agentTerminal).not.toHaveBeenCalled();
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/billing');
  });
});
