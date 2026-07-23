import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WebLLMPreloader } from './web-llm-preloader';

const useWebLLM = vi.hoisted(() => vi.fn());

vi.mock('@/layers/apps/web/hooks/agent/useWebLLM', () => ({
  useWebLLM,
}));

describe('WebLLMPreloader', () => {
  it('렌더링되면 모델 초기화 훅을 호출한다', () => {
    renderToStaticMarkup(createElement(WebLLMPreloader));

    expect(useWebLLM).toHaveBeenCalledOnce();
  });
});
