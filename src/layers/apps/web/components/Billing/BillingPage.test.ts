// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthSnapshot } from '@/layers/auth/i-auth-client';
import type { BillingSubscription } from '@/layers/billing/i-billing-client';
import { BillingPage } from './BillingPage';

const billingPageMocks = vi.hoisted(() => ({
  authSnapshot: { status: 'anonymous', user: null } as AuthSnapshot,
  subscription: undefined as BillingSubscription | undefined,
  subscriptionPending: false,
  subscriptionError: false,
  mutate: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    mutate: billingPageMocks.mutate,
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAuthSnapshot: () => billingPageMocks.authSnapshot,
  useBillingClient: () => ({
    requestBillingAuthorization: vi.fn(),
    cancelSubscription: vi.fn(),
  }),
}));

vi.mock('../../billing/billing-queries', () => ({
  billingQueryKeys: {
    subscription: (userId: string) => ['billing', 'subscription', userId],
    entitlement: (userId: string) => ['billing', 'entitlement', userId],
  },
  useBillingPlanQuery: () => ({
    data: { planCode: 'pro', amountKrw: 12_000, currency: 'KRW', interval: 'month' },
    isError: false,
  }),
  useBillingSubscriptionQuery: () => ({
    data: billingPageMocks.subscription,
    isPending: billingPageMocks.subscriptionPending,
    isError: billingPageMocks.subscriptionError,
  }),
}));

vi.mock('./BillingPage.css', () => ({
  page: 'page',
  panel: 'panel',
  brand: 'brand',
  title: 'title',
  description: 'description',
  price: 'price',
  interval: 'interval',
  statusBox: 'statusBox',
  statusTitle: 'statusTitle',
  statusDescription: 'statusDescription',
  actionRow: 'actionRow',
  primaryAction: 'primaryAction',
  secondaryAction: 'secondaryAction',
  notice: 'notice',
  error: 'error',
  success: 'success',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderBillingPage(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(MemoryRouter, null, createElement(BillingPage))));
  return host;
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  billingPageMocks.authSnapshot = { status: 'anonymous', user: null };
  billingPageMocks.subscription = undefined;
  billingPageMocks.subscriptionPending = false;
  billingPageMocks.subscriptionError = false;
  billingPageMocks.mutate.mockClear();
});

describe('BillingPage', () => {
  it('로그아웃 사용자는 월 가격과 로그인 경로를 확인한다', () => {
    const host = renderBillingPage();

    expect(host.textContent).toContain('12,000원');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/login');
  });

  it('구독이 없는 로그인 사용자는 카드 등록을 시작할 수 있다', () => {
    billingPageMocks.authSnapshot = {
      status: 'authenticated',
      user: { id: 'user-1', email: 'user@example.com' },
    };
    billingPageMocks.subscription = {
      status: 'none',
      amountKrw: null,
      currentPeriodEnd: null,
      cardLastFour: null,
    };

    const host = renderBillingPage();
    const startButton = host.querySelector('button');

    expect(startButton?.textContent).toBe('카드 등록하고 시작하기');
    act(() => startButton?.click());
    expect(billingPageMocks.mutate).toHaveBeenCalledTimes(1);
  });

  it('활성 구독은 다음 결제일과 카드 끝자리를 표시한다', () => {
    billingPageMocks.authSnapshot = {
      status: 'authenticated',
      user: { id: 'user-1', email: 'user@example.com' },
    };
    billingPageMocks.subscription = {
      status: 'active',
      amountKrw: 12_000,
      currentPeriodEnd: '2026-08-31T00:00:00.000Z',
      cardLastFour: '1234',
    };

    const host = renderBillingPage();

    expect(host.textContent).toContain('Pro 구독 사용 중');
    expect(host.textContent).toContain('카드 끝자리 1234');
    expect(host.querySelector('button')?.textContent).toBe('다음 결제 취소 예약');
  });
});
