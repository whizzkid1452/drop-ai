// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RegionState } from '@/layers/session/session';
import { createDefaultRegionProcessingState } from '@/layers/shared/types/region-processing';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { RegionProcessingControls } from './RegionProcessingControls';

const execute = vi.fn<(command: AudioCommand) => Promise<void>>().mockResolvedValue(undefined);

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute }),
}));

vi.mock('./RegionProcessingControls.css.ts', () => ({
  checkbox: 'checkbox',
  control: 'control',
  controlRow: 'controlRow',
  label: 'label',
  value: 'value',
}));

const region: RegionState = {
  ...createDefaultRegionProcessingState(2),
  duration: 4,
  endTime: 5,
  gain: 0.8,
  id: '22222222-2222-4222-8222-222222222222',
  sourceId: '33333333-3333-4333-8333-333333333333',
  sourceStartTime: 0,
  startTime: 1,
  status: [],
};
const trackId = '11111111-1111-4111-8111-111111111111';
const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderControls(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(RegionProcessingControls, { region, trackId })));
  return host;
}

function changeInput(host: HTMLElement, label: string, value: string): void {
  const input = host.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
  if (!input) {
    throw new Error(`${label} 입력을 찾을 수 없습니다.`);
  }
  const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setInputValue) {
    throw new Error('HTML input value setter를 찾을 수 없습니다.');
  }
  act(() => {
    setInputValue.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  execute.mockClear();
});

describe('RegionProcessingControls', () => {
  it.each([
    ['Region gain', '0.5', { gain: 0.5 }],
    ['Region fade in', '0.4', { fadeIn: { curve: 'linear', durationSeconds: 0.4 } }],
    ['Region fade out', '0.7', { fadeOut: { curve: 'linear', durationSeconds: 0.7 } }],
    ['Region layer', '4', { layer: 4 }],
  ] as const)('%s 값을 SET_REGION_PROCESSING 명령으로 변환한다', (label, value, update) => {
    const host = renderControls();

    changeInput(host, label, value);

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.SET_REGION_PROCESSING,
      regionId: region.id,
      trackId,
      ...update,
    });
  });

  it('opaque 체크 상태를 SET_REGION_PROCESSING 명령으로 변환한다', () => {
    const host = renderControls();

    act(() => host.querySelector<HTMLInputElement>('[aria-label="Region opaque"]')?.click());

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.SET_REGION_PROCESSING,
      isOpaque: true,
      regionId: region.id,
      trackId,
    });
  });
});
