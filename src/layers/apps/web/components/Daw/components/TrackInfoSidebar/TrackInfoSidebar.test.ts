// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LoopSlotState, TrackState } from '@/layers/session/session';
import { createDefaultRegionProcessingState } from '@/layers/shared/types/region-processing';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { TrackInfoSidebar } from './TrackInfoSidebar';

const executeCommand = vi.fn().mockResolvedValue(undefined);
const showBoundary = vi.fn();
const splitRegion = vi.fn().mockResolvedValue(undefined);
const layerMocks = {
  currentTime: 5,
  tracks: new Map<string, TrackState>(),
};

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute: executeCommand }),
  useSession: (selector: (state: typeof layerMocks) => unknown) => selector(layerMocks),
}));

vi.mock('react-error-boundary', () => ({
  useErrorBoundary: () => ({ showBoundary }),
}));

vi.mock('@/layers/apps/web/hooks/useTrackActions', () => ({
  useTrackActions: () => ({ splitRegion }),
}));

vi.mock('../Track/components/TrackVolumeController', () => ({
  TrackVolumeController: ({ onVolumeChange }: { onVolumeChange: (volume: number) => void }) =>
    createElement('button', { onClick: () => onVolumeChange(0.5), 'data-testid': 'volume-control' }, 'Volume'),
}));

vi.mock('../Track/components/TrackPanController', () => ({
  TrackPanController: ({ onPanChange }: { onPanChange: (pan: number) => void }) =>
    createElement('button', { onClick: () => onPanChange(-0.25), 'data-testid': 'pan-control' }, 'Pan'),
}));

vi.mock('../Track/components/TrackPluginControls', () => ({
  TrackPluginControls: ({ trackId }: { trackId: string }) =>
    createElement('div', { 'data-testid': 'plugin-controls', 'data-track-id': trackId }),
}));

vi.mock('../Track/components/LoopSlotControls', () => ({
  LoopSlotControls: ({ trackId }: { trackId: string }) =>
    createElement('div', { 'data-testid': 'loop-controls', 'data-track-id': trackId }),
}));

vi.mock('../Track/components/TrackRegionImportControl', () => ({
  TrackRegionImportControl: ({ onPendingChange }: { onPendingChange?: (isPending: boolean) => void }) =>
    createElement(
      'button',
      { 'aria-label': 'Region 오디오 파일 추가', onClick: () => onPendingChange?.(true) },
      '+ AUDIO'
    ),
}));

vi.mock('./TrackInfoSidebar.css.ts', () => ({
  actionButton: 'actionButton',
  actions: 'actions',
  container: 'container',
  contentArea: 'contentArea',
  dangerButton: 'dangerButton',
  emptyMessage: 'emptyMessage',
  mixControls: 'mixControls',
  section: 'section',
  sectionTitle: 'sectionTitle',
  titleBar: 'titleBar',
  trackName: 'trackName',
}));

const mountedRoots: Root[] = [];
const loopSlot: LoopSlotState = {
  id: '33333333-3333-4333-8333-333333333333',
  sourceId: null,
  overdubSourceIds: [],
  lengthBars: 1,
  quantizationBars: 1,
  recordedTempoBpm: null,
  gain: 1,
  state: 'empty',
  scheduledTimeSeconds: null,
  errorMessage: null,
};
const selectedTrack: TrackState = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '선택 Track',
  volume: 1,
  pan: 0,
  isMuted: false,
  isSoloed: false,
  status: [],
  pluginInstances: [],
  regions: [
    {
      ...createDefaultRegionProcessingState(),
      id: '22222222-2222-4222-8222-222222222222',
      sourceId: '44444444-4444-4444-8444-444444444444',
      startTime: 0,
      endTime: 10,
      sourceStartTime: 0,
      duration: 10,
      status: [],
    },
  ],
  loopSlots: [loopSlot],
};

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderSidebar(selectedTrackId: string | null): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);

  act(() => root.render(createElement(TrackInfoSidebar, { selectedTrackId })));

  return host;
}

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
  layerMocks.currentTime = 5;
  layerMocks.tracks = new Map();
  executeCommand.mockClear();
  showBoundary.mockClear();
  splitRegion.mockClear();
  vi.restoreAllMocks();
});

describe('TrackInfoSidebar', () => {
  it('선택한 Track의 Mix·Plugin·Loop 제어만 표시한다', () => {
    const otherTrack = { ...selectedTrack, id: '55555555-5555-4555-8555-555555555555', name: '다른 Track' };
    layerMocks.tracks = new Map([
      [otherTrack.id, otherTrack],
      [selectedTrack.id, selectedTrack],
    ]);

    const host = renderSidebar(selectedTrack.id);

    expect(host.querySelector('.trackName')?.textContent).toBe(selectedTrack.name);
    expect(host.querySelector<HTMLElement>('[data-testid="plugin-controls"]')?.dataset.trackId).toBe(selectedTrack.id);
    expect(host.querySelector<HTMLElement>('[data-testid="loop-controls"]')?.dataset.trackId).toBe(selectedTrack.id);
    expect(host.textContent).not.toContain(otherTrack.name);
  });

  it('선택한 Track이 없으면 안내 문구를 표시한다', () => {
    const host = renderSidebar(null);

    expect(host.textContent).toContain('Track을 선택하세요.');
    expect(host.querySelector('[data-testid="plugin-controls"]')).toBeNull();
  });

  it('Volume과 Pan 변경을 선택한 Track 명령으로 실행한다', async () => {
    layerMocks.tracks = new Map([[selectedTrack.id, selectedTrack]]);
    const host = renderSidebar(selectedTrack.id);

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="volume-control"]')?.click();
      host.querySelector<HTMLButtonElement>('[data-testid="pan-control"]')?.click();
    });

    expect(executeCommand).toHaveBeenCalledWith({
      type: AudioCommandType.SET_TRACK_VOLUME,
      trackId: selectedTrack.id,
      volume: 0.5,
    });
    expect(executeCommand).toHaveBeenCalledWith({
      type: AudioCommandType.SET_TRACK_PAN,
      trackId: selectedTrack.id,
      pan: -0.25,
    });
  });

  it('재생 위치의 Region을 선택한 Track에서 분할한다', async () => {
    layerMocks.tracks = new Map([[selectedTrack.id, selectedTrack]]);
    const host = renderSidebar(selectedTrack.id);

    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[aria-label="선택 Track Region 분할"]')?.click();
    });

    expect(splitRegion).toHaveBeenCalledWith({
      trackId: selectedTrack.id,
      regionId: selectedTrack.regions[0].id,
      splitTime: layerMocks.currentTime,
    });
  });

  it('Region 가져오기 중에는 Track 삭제를 막는다', () => {
    layerMocks.tracks = new Map([[selectedTrack.id, selectedTrack]]);
    const host = renderSidebar(selectedTrack.id);
    const importButton = host.querySelector<HTMLButtonElement>('button[aria-label="Region 오디오 파일 추가"]');
    const removeButton = host.querySelector<HTMLButtonElement>('button[aria-label="선택 Track 삭제"]');

    act(() => importButton?.click());

    expect(removeButton?.disabled).toBe(true);
  });
});
