// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from './AppRouter';

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useSession: (selector: (state: { tracks: ReadonlyMap<string, unknown> }) => unknown) =>
    selector({ tracks: new Map() }),
}));

vi.mock('@/layers/apps/web/components/Daw/DawPage', () => ({
  DawPage: () => createElement('div', { 'data-testid': 'daw-page' }),
}));

vi.mock('@/layers/apps/web/components/Daw/components/Drop/DropPage', () => ({
  DropPage: () => createElement('div', { 'data-testid': 'drop-page' }),
}));

vi.mock('../../cli/cli-test-page', () => ({
  CliTestPage: () => null,
}));

vi.mock('../components/Auth/LoginPage', () => ({ LoginPage: () => null }));
vi.mock('../components/Billing/BillingFailPage', () => ({ BillingFailPage: () => null }));
vi.mock('../components/Billing/BillingPage', () => ({ BillingPage: () => null }));
vi.mock('../components/Billing/BillingSuccessPage', () => ({ BillingSuccessPage: () => null }));

const mountedRoots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
});

describe('AppRouter', () => {
  it('Track이 없는 새 프로젝트도 DAW 화면을 연다', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => root.render(createElement(MemoryRouter, { initialEntries: ['/daw'] }, createElement(AppRouter))));

    expect(host.querySelector('[data-testid="daw-page"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="drop-page"]')).toBeNull();
  });
});
