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
  timelineMarkers: [],
};

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute }),
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
    const clearButton = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Clear');

    expect(range?.style.left).toBe('96px');
    expect(range?.style.width).toBe('288px');
    await act(async () => clearButton?.click());
    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.CLEAR_EXPORT_RANGE });
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
