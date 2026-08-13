// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { MarkerRangeRuler } from './MarkerRangeRuler';

const execute = vi.fn().mockResolvedValue(undefined);
const layerState = {
  exportEndTime: 4,
  exportStartTime: 1,
  isLoopEnabled: false,
  loopRange: { startTimeSeconds: 2, endTimeSeconds: 5 },
  timelineMarkers: [],
};

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute }),
  useAudioRuntimeCapabilities: () => ({
    features: { tempoLoopMetronome: { blockers: [], status: 'available' } },
  }),
  usePlaybackClock: () => ({ getCurrentTime: () => 2 }),
  useSession: (selector: (state: typeof layerState) => unknown) => selector(layerState),
}));

vi.mock('@/layers/apps/web/keyboard-shortcuts/keyboard-shortcuts', () => ({
  KeyboardShortcutAction: { CLEAR_EXPORT_RANGE: 'CLEAR_EXPORT_RANGE' },
  KEYBOARD_SHORTCUT_LABELS: { CLEAR_EXPORT_RANGE: 'Esc' },
  useKeyboardShortcutAction: vi.fn(),
}));

vi.mock('./MarkerRangeRuler.css.ts', () => ({
  addButton: 'addButton',
  clearButton: 'clearButton',
  container: 'container',
  deleteButton: 'deleteButton',
  dragHandle: 'dragHandle',
  errorMessage: 'errorMessage',
  exportRange: 'exportRange',
  exportRangeLabel: 'exportRangeLabel',
  loopRange: 'loopRange',
  loopRangeEnabled: 'loopRangeEnabled',
  loopRangeLabel: 'loopRangeLabel',
  lane: 'lane',
  marker: 'marker',
  markerInput: 'markerInput',
  rangeLane: 'rangeLane',
}));

vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-4111-8111-111111111111' });

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  execute.mockClear();
});

describe('MarkerRangeRuler', () => {
  it('현재 playhead의 grid 위치에 Timeline marker를 추가한다', async () => {
    const container = renderRuler();
    const addButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === '+ Marker'
    );

    await act(async () => addButton?.click());

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.SET_TIMELINE_MARKERS,
      markers: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Marker 1',
          quarterNotePosition: 4,
        },
      ],
    });
  });

  it('내보내기 범위를 표시하고 Clear 명령을 실행한다', async () => {
    const container = renderRuler();
    const range = container.querySelector<HTMLElement>('[data-testid="export-range"]');
    const clearButton = container.querySelector<HTMLButtonElement>('[aria-label="Export 범위 지우기"]');

    expect(range?.style.left).toBe('96px');
    expect(range?.style.width).toBe('288px');
    await act(async () => clearButton?.click());
    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.CLEAR_EXPORT_RANGE });
  });

  it('Loop 범위를 별도 lane에 표시하고 Clear 명령을 실행한다', async () => {
    const container = renderRuler();
    const range = container.querySelector<HTMLElement>('[data-testid="loop-range"]');
    const clearButton = Array.from(container.querySelectorAll('button')).find(
      button => button.getAttribute('aria-label') === 'Loop 범위 지우기'
    );

    expect(range?.style.left).toBe('192px');
    expect(range?.style.width).toBe('288px');
    await act(async () => clearButton?.click());
    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.CLEAR_LOOP_RANGE });
  });

  it('Loop lane을 drag하면 snap된 범위를 활성 상태로 설정한다', async () => {
    const container = renderRuler();
    const loopLane = container.querySelector<HTMLDivElement>('[aria-label="Loop Range"]');
    if (!loopLane) {
      throw new Error('Loop Range lane을 찾지 못했습니다.');
    }
    loopLane.setPointerCapture = vi.fn();
    loopLane.releasePointerCapture = vi.fn();
    loopLane.getBoundingClientRect = () => ({
      bottom: 24,
      height: 24,
      left: 0,
      right: 640,
      top: 0,
      width: 640,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    await act(async () => {
      loopLane.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 96, pointerId: 1 }));
      loopLane.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 288, pointerId: 1 }));
      loopLane.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 288, pointerId: 1 }));
    });

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.SET_LOOP_RANGE,
      startTimeSeconds: 1,
      endTimeSeconds: 3,
      isEnabled: true,
    });
  });
});

function renderRuler(): HTMLDivElement {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push(root);
  const coordinateMapper = new TimelineCoordinateMapper({
    tempoBpm: 120,
    beatsPerBar: 4,
    beatUnit: 4,
    pixelsPerQuarterNote: 48,
  });

  act(() => {
    root.render(
      createElement(MarkerRangeRuler, {
        coordinateMapper,
        gridSettings: { division: 'beat', snapMode: 'grid' },
        timelineContentWidth: 640,
      })
    );
  });
  return container;
}
