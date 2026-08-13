// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrackState } from '@/layers/session/session';
import { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import { AutomationLaneEditor } from './AutomationLaneEditor';

vi.mock('./AutomationLaneEditor.css.ts', () => ({
  automationControl: 'automationControl',
  automationControls: 'automationControls',
  automationError: 'automationError',
  automationHeader: 'automationHeader',
  automationLane: 'automationLane',
  automationLine: 'automationLine',
  automationPoint: 'automationPoint',
  automationRange: 'automationRange',
  automationToolbar: 'automationToolbar',
  automationWriteControl: 'automationWriteControl',
  automationWriteInput: 'automationWriteInput',
  automationWriteOutput: 'automationWriteOutput',
  selectedAutomationPoint: 'selectedAutomationPoint',
}));

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const LANE_ID = '22222222-2222-4222-8222-222222222222';
const POINT_ID = '33333333-3333-4333-8333-333333333333';
const NEW_POINT_ID = '44444444-4444-4444-8444-444444444444';
const track: TrackState = {
  automationLanes: [
    {
      id: LANE_ID,
      isEnabled: true,
      mode: 'read',
      points: [{ id: POINT_ID, interpolation: 'linear', timeSeconds: 1, value: 0.5 }],
      target: { kind: 'trackVolume' },
    },
  ],
  id: TRACK_ID,
  isMuted: false,
  isSoloed: false,
  name: 'Voice',
  pan: 0,
  pluginInstances: [],
  regions: [],
  status: [],
  volume: 1,
};
const coordinateMapper = new TimelineCoordinateMapper({
  beatUnit: 4,
  beatsPerBar: 4,
  pixelsPerQuarterNote: 50,
  tempoBpm: 120,
});
const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderEditor(
  options: {
    createId?: () => string;
    editPointSeconds?: number;
    getCurrentTime?: () => number;
    onChange?: (automationLanes: TrackState['automationLanes']) => Promise<void>;
    onWriteCancel?: (laneId: string) => Promise<void>;
    onWriteCommit?: (request: unknown) => Promise<void>;
    onWritePreview?: (request: unknown) => Promise<void>;
    selectedRange?: { endTimeSeconds: number; startTimeSeconds: number } | null;
    track?: TrackState;
  } = {}
) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  const onChange = options.onChange ?? vi.fn().mockResolvedValue(undefined);
  const onWriteCancel = options.onWriteCancel ?? vi.fn().mockResolvedValue(undefined);
  const onWriteCommit = options.onWriteCommit ?? vi.fn().mockResolvedValue(undefined);
  const onWritePreview = options.onWritePreview ?? vi.fn().mockResolvedValue(undefined);
  const renderedTrack = options.track ?? track;

  act(() => {
    root.render(
      createElement(AutomationLaneEditor, {
        coordinateMapper,
        createId: options.createId ?? (() => NEW_POINT_ID),
        editPointSeconds: options.editPointSeconds ?? 2,
        getCurrentTime: options.getCurrentTime ?? (() => 0),
        onChange,
        onWriteCancel,
        onWriteCommit,
        onWritePreview,
        pluginCatalog: new Map(),
        routingGraph: { routes: [], sends: [] },
        selectedRange: options.selectedRange ?? null,
        track: renderedTrack,
        trackNamesById: new Map([[TRACK_ID, renderedTrack.name]]),
      })
    );
  });

  return { host, onChange, onWriteCancel, onWriteCommit, onWritePreview };
}

afterEach(() => {
  vi.useRealTimers();
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
});

describe('AutomationLaneEditor', () => {
  it('Lane을 선택하고 edit point에 점을 추가한다', async () => {
    const { host, onChange } = renderEditor();

    await act(async () =>
      host.querySelector<HTMLButtonElement>('button[aria-label="Voice Automation 점 추가"]')?.click()
    );

    expect(onChange).toHaveBeenCalledWith([
      {
        ...track.automationLanes?.[0],
        points: [
          track.automationLanes?.[0]?.points[0],
          { id: NEW_POINT_ID, interpolation: 'linear', timeSeconds: 2, value: 0.5 },
        ],
      },
    ]);
  });

  it('선택한 점을 삭제한다', async () => {
    const { host, onChange } = renderEditor();
    const pointButton = host.querySelector<HTMLButtonElement>(`button[data-point-id="${POINT_ID}"]`);

    act(() => pointButton?.click());
    await act(async () =>
      host.querySelector<HTMLButtonElement>('button[aria-label="선택한 Automation 점 삭제"]')?.click()
    );

    expect(onChange).toHaveBeenCalledWith([{ ...track.automationLanes?.[0], points: [] }]);
  });

  it('키보드로 선택 점을 이동한다', async () => {
    const { host, onChange } = renderEditor();
    const pointButton = host.querySelector<HTMLButtonElement>(`button[data-point-id="${POINT_ID}"]`);

    await act(async () => {
      pointButton?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
    });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...track.automationLanes?.[0],
        points: [{ ...track.automationLanes?.[0]?.points[0], timeSeconds: 1.1 }],
      },
    ]);
  });

  it('선택 Range 안의 점을 지운다', async () => {
    const { host, onChange } = renderEditor({ selectedRange: { endTimeSeconds: 1.5, startTimeSeconds: 0.5 } });

    await act(async () =>
      host.querySelector<HTMLButtonElement>('button[aria-label="선택 Range Automation 지우기"]')?.click()
    );

    expect(onChange).toHaveBeenCalledWith([{ ...track.automationLanes?.[0], points: [] }]);
  });

  it('Automation mode를 변경한다', async () => {
    const { host, onChange } = renderEditor();
    const modeSelect = host.querySelector<HTMLSelectElement>('select[aria-label="Voice Automation mode"]');

    await act(async () => {
      if (modeSelect) {
        modeSelect.value = 'touch';
        modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(onChange).toHaveBeenCalledWith([{ ...track.automationLanes?.[0], mode: 'touch' }]);
  });

  it('write value gesture를 50ms 단위로 preview하고 종료 시 한 번 commit한다', async () => {
    vi.useFakeTimers();
    const writeTrack: TrackState = {
      ...track,
      automationLanes: track.automationLanes?.map(lane => ({ ...lane, mode: 'touch' })),
    };
    const times = [1, 1.1, 1.2];
    let idIndex = 0;
    const { host, onWriteCommit, onWritePreview } = renderEditor({
      createId: () => `55555555-5555-4555-8555-55555555555${idIndex++}`,
      getCurrentTime: () => times.shift() ?? 1.2,
      track: writeTrack,
    });
    const writeInput = host.querySelector<HTMLInputElement>('input[aria-label="Voice Automation write value"]');

    await act(async () => {
      writeInput?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true, pointerId: 1 })
      );
      if (writeInput) {
        writeInput.value = '0.75';
        writeInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(onWritePreview).toHaveBeenCalledTimes(1);
    expect(onWritePreview).toHaveBeenCalledWith(
      expect.objectContaining({
        samples: [
          expect.objectContaining({ timeSeconds: 1, value: 0.5 }),
          expect.objectContaining({ timeSeconds: 1.1, value: 0.75 }),
        ],
      })
    );

    await act(async () => {
      writeInput?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    });

    expect(onWriteCommit).toHaveBeenCalledTimes(1);
    expect(onWriteCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        laneId: LANE_ID,
        passRange: { endTimeSeconds: 1.2, startTimeSeconds: 1 },
        samples: [
          expect.objectContaining({ timeSeconds: 1, value: 0.5 }),
          expect.objectContaining({ timeSeconds: 1.1, value: 0.75 }),
          expect.objectContaining({ timeSeconds: 1.2, value: 0.75 }),
        ],
      })
    );
  });

  it('write value gesture를 취소하면 preview를 원래 Lane으로 복원한다', async () => {
    const writeTrack: TrackState = {
      ...track,
      automationLanes: track.automationLanes?.map(lane => ({ ...lane, mode: 'latch' })),
    };
    const { host, onWriteCancel, onWriteCommit } = renderEditor({ track: writeTrack });
    const writeInput = host.querySelector<HTMLInputElement>('input[aria-label="Voice Automation write value"]');

    await act(async () => {
      writeInput?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true, pointerId: 2 })
      );
      writeInput?.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 2 }));
    });

    expect(onWriteCancel).toHaveBeenCalledWith(LANE_ID);
    expect(onWriteCommit).not.toHaveBeenCalled();
  });
});
