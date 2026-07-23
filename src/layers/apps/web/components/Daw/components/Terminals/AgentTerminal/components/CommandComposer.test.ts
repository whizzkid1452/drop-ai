// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandComposer } from './CommandComposer';

vi.mock('../ChatModalTerminal.css.ts', () => ({
  composer: 'composer',
  composerRow: 'composerRow',
  inputWrapper: 'inputWrapper',
  cornerMarker: 'cornerMarker',
  topLeft: 'topLeft',
  bottomRight: 'bottomRight',
  promptSymbol: 'promptSymbol',
  inputField: 'inputField',
  executeButton: 'executeButton',
  stopButton: 'stopButton',
  footer: 'footer',
  footerStats: 'footerStats',
  statItem: 'statItem',
  statusIndicators: 'statusIndicators',
  indicator: 'indicator',
  activeIndicator: 'activeIndicator',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderComposer(props: React.ComponentProps<typeof CommandComposer>) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(CommandComposer, props)));
  return host;
}

function createProps(overrides: Partial<React.ComponentProps<typeof CommandComposer>> = {}) {
  return {
    input: '드럼 볼륨을 줄여줘',
    modelStatus: 'ready' as const,
    agentStatus: 'idle' as const,
    onInputChange: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
    onKeyDown: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
});

describe('CommandComposer', () => {
  it('응답 생성 중에는 실행 버튼을 중지 버튼으로 바꾼다', () => {
    const onStop = vi.fn();
    const host = renderComposer(createProps({ agentStatus: 'generating', onStop }));
    const button = host.querySelector<HTMLButtonElement>('button');

    expect(button?.textContent).toContain('STOP');
    expect(button?.getAttribute('aria-label')).toBe('응답 생성 중지');

    act(() => button?.click());

    expect(onStop).toHaveBeenCalledOnce();
  });

  it('모델 준비 중에는 현재 상태와 전송 불가 이유를 표시한다', () => {
    const host = renderComposer(createProps({ modelStatus: 'loading' }));

    expect(host.textContent).toContain('MODEL PREPARING');
    expect(host.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true);
    expect(host.querySelector('textarea')?.getAttribute('placeholder')).toContain('model loads');
  });

  it('명령 실행 중에는 중단 버튼을 노출하지 않는다', () => {
    const host = renderComposer(createProps({ agentStatus: 'executing' }));
    const button = host.querySelector<HTMLButtonElement>('button');

    expect(button?.textContent).toContain('APPLYING');
    expect(button?.disabled).toBe(true);
  });
});
