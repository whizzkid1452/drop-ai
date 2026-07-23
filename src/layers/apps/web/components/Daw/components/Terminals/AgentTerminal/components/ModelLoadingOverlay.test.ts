// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelLoadingOverlay } from './ModelLoadingOverlay';

vi.mock('../ChatModalTerminal.css.ts', () => ({
  loadingArea: 'loadingArea',
  progressBarContainer: 'progressBarContainer',
  progressBar: 'progressBar',
  statusStrip: 'statusStrip',
  statusInfo: 'statusInfo',
  statusText: 'statusText',
  statusLabel: 'statusLabel',
  statusDescription: 'statusDescription',
  retryButton: 'retryButton',
  spinning: 'spinning',
  primaryColor: '#ff4fd8',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderOverlay(props: React.ComponentProps<typeof ModelLoadingOverlay>) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(ModelLoadingOverlay, props)));
  return host;
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
});

describe('ModelLoadingOverlay', () => {
  it('모델 준비 중임과 정규화된 진행률을 알린다', () => {
    const host = renderOverlay({
      status: 'loading',
      progress: 0.42,
      loadingText: 'Fetching model',
      onRetry: vi.fn(),
    });

    expect(host.textContent).toContain('AI MODEL IS NOT READY');
    expect(host.textContent).toContain('42%');
    expect(host.textContent).toContain('QWEN2.5 0.5B');
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('42');
  });

  it('모델 로드 실패를 알리고 재시도를 제공한다', () => {
    const onRetry = vi.fn();
    const host = renderOverlay({
      status: 'error',
      progress: 0,
      loadingText: 'WebGPU unavailable',
      onRetry,
    });

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('MODEL LOAD FAILED');
    const retryButton = host.querySelector<HTMLButtonElement>('button');
    expect(retryButton?.textContent).toContain('RETRY');

    act(() => retryButton?.click());

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
