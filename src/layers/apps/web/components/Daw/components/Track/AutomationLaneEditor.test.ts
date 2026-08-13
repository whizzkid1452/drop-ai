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
    editPointSeconds?: number;
    onChange?: (automationLanes: TrackState['automationLanes']) => Promise<void>;
    selectedRange?: { endTimeSeconds: number; startTimeSeconds: number } | null;
  } = {}
) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  const onChange = options.onChange ?? vi.fn().mockResolvedValue(undefined);

  act(() => {
    root.render(
      createElement(AutomationLaneEditor, {
        coordinateMapper,
        createId: () => NEW_POINT_ID,
        editPointSeconds: options.editPointSeconds ?? 2,
        onChange,
        pluginCatalog: new Map(),
        routingGraph: { routes: [], sends: [] },
        selectedRange: options.selectedRange ?? null,
        track,
        trackNamesById: new Map([[TRACK_ID, track.name]]),
      })
    );
  });

  return { host, onChange };
}

afterEach(() => {
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
});
