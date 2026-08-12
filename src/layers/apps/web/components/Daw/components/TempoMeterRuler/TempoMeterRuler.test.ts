// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { TempoMeterRuler } from './TempoMeterRuler';

const execute = vi.fn().mockResolvedValue(undefined);
const layerState = {
  tempoChanges: [{ quarterNotePosition: 0, bpm: 120 }],
  meterChanges: [{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }],
};

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute }),
  usePlaybackClock: () => ({ getCurrentTime: () => 2 }),
  useSession: (selector: (state: typeof layerState) => unknown) => selector(layerState),
}));

vi.mock('./TempoMeterRuler.css.ts', () => ({
  addButton: 'addButton',
  beatUnitSelect: 'beatUnitSelect',
  container: 'container',
  deleteButton: 'deleteButton',
  dragHandle: 'dragHandle',
  errorMessage: 'errorMessage',
  lane: 'lane',
  marker: 'marker',
  meterInput: 'meterInput',
  meterMarker: 'meterMarker',
  unit: 'unit',
  valueInput: 'valueInput',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
  execute.mockClear();
});

describe('TempoMeterRuler', () => {
  it('현재 playhead의 grid 위치에 Tempo marker를 추가한다', async () => {
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
        createElement(TempoMeterRuler, {
          coordinateMapper,
          gridSettings: { division: 'beat', snapMode: 'grid' },
          timelineContentWidth: 640,
        })
      );
    });
    const addTempoButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === '+ Tempo'
    );

    await act(async () => {
      addTempoButton?.click();
    });

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.SET_TIMELINE_MAP,
      tempoChanges: [
        { quarterNotePosition: 0, bpm: 120 },
        { quarterNotePosition: 4, bpm: 120 },
      ],
      meterChanges: [{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }],
    });
  });
});
