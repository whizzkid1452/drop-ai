// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrackState } from '@/layers/session/session';
import type { TrackToggleResult } from '@/layers/apps/web/hooks/track-mute-solo-commands';
import { TrackComponent } from './TrackComponent';
import { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';

vi.mock('@/layers/apps/web/hooks/useTrackActions', () => ({
  useTrackActions: () => ({
    moveRegion: vi.fn(),
    removeRegion: vi.fn(),
  }),
}));

vi.mock('./RegionComponent', () => ({
  RegionComponent: () => null,
}));

vi.mock('../AudioLevelMeter/AudioLevelMeter', () => ({
  AudioLevelMeter: ({ label }: { label: string }) => createElement('div', { 'data-meter-label': label }),
}));

vi.mock('../LiveInputControls/TrackInputMonitoringControl', () => ({
  TrackInputMonitoringControl: ({ trackName }: { trackName: string }) =>
    createElement('button', { 'aria-label': `${trackName} 입력 모니터링` }),
}));

vi.mock('./Track.css.ts', () => ({
  actionControls: 'actionControls',
  muteButtonActive: 'muteButtonActive',
  soloButtonActive: 'soloButtonActive',
  trackActionButton: 'trackActionButton',
  trackHeader: 'trackHeader',
  trackHeaderSelected: 'trackHeaderSelected',
  trackRow: 'trackRow',
  trackTimeline: 'trackTimeline',
}));

vi.mock('./components/TrackNameControl', () => ({
  TrackNameControl: ({ trackId, name }: { trackId: string; name: string }) =>
    createElement('div', {
      'data-name': name,
      'data-testid': 'track-name-control',
      'data-track-id': trackId,
    }),
}));

vi.mock('./components/TrackPluginControls', () => ({
  TrackPluginControls: () => createElement('div', { 'data-testid': 'track-plugin-controls' }),
}));

vi.mock('./components/LoopSlotControls', () => ({
  LoopSlotControls: () => createElement('div', { 'data-testid': 'loop-controls' }),
}));

vi.mock('./components/TrackRegionImportControl', () => ({
  TrackRegionImportControl: () => createElement('button', { 'aria-label': 'Region 오디오 파일 추가' }),
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

const mountedRoots: Root[] = [];
const coordinateMapper = new TimelineCoordinateMapper({
  tempoBpm: 120,
  beatsPerBar: 4,
  beatUnit: 4,
  pixelsPerQuarterNote: 50,
});
const gridSettings = { division: 'beat', snapMode: 'off' } as const;
const track: TrackState = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '빈 Track',
  volume: 1,
  pan: 0,
  isMuted: false,
  isSoloed: false,
  status: [],
  pluginInstances: [],
  regions: [],
};
const waveformRenderCache = new Map();

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function renderTrack(
  options: {
    isSelected?: boolean;
    onMuteChange?: (muted: boolean) => Promise<TrackToggleResult>;
    onSelect?: () => void;
    onSoloChange?: (soloed: boolean) => Promise<TrackToggleResult>;
    track?: TrackState;
  } = {}
): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);

  act(() => {
    root.render(
      createElement(TrackComponent, {
        track: options.track ?? track,
        isSelected: options.isSelected ?? false,
        coordinateMapper,
        gridSettings,
        waveformRenderCache,
        onReady: vi.fn(),
        onMuteChange: options.onMuteChange ?? vi.fn().mockResolvedValue('updated'),
        onSelect: options.onSelect ?? vi.fn(),
        onSoloChange: options.onSoloChange ?? vi.fn().mockResolvedValue('updated'),
      })
    );
  });

  return host;
}

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
});

describe('TrackComponent 제어', () => {
  it('Track 제어부와 타임라인을 하나의 편집 행으로 렌더링한다', () => {
    const host = renderTrack();

    expect(host.querySelector(`article[aria-label="Track ${track.name}"]`)).not.toBeNull();
    expect(host.querySelector(`[aria-label="${track.name} timeline"]`)).not.toBeNull();
    expect(host.querySelector(`[aria-label="${track.name} 입력 모니터링"]`)).not.toBeNull();
    expect(host.querySelector('[data-meter-label="Track"]')).not.toBeNull();
  });

  it('Track 행을 누르면 선택을 요청하고 선택 상태를 표시한다', () => {
    const onSelect = vi.fn();
    const host = renderTrack({ isSelected: true, onSelect });
    const trackRow = host.querySelector<HTMLElement>(`article[aria-label="Track ${track.name}"]`);

    act(() => trackRow?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(trackRow?.dataset.selected).toBe('true');
    expect(host.querySelector('.trackHeader')?.classList.contains('trackHeaderSelected')).toBe(true);
  });

  it('상세 Plugin·Loop·Import·삭제 제어를 Track 헤더에 렌더링하지 않는다', () => {
    const host = renderTrack();

    expect(host.querySelector('[data-testid="track-plugin-controls"]')).toBeNull();
    expect(host.querySelector('[data-testid="loop-controls"]')).toBeNull();
    expect(host.querySelector('button[aria-label="Region 오디오 파일 추가"]')).toBeNull();
    expect(host.querySelector('button[aria-label="Track 삭제"]')).toBeNull();
  });

  it('현재 Mute·Solo 상태를 표시하고 반대 상태를 요청한다', async () => {
    const onMuteChange = vi.fn().mockResolvedValue('updated');
    const onSoloChange = vi.fn().mockResolvedValue('updated');
    const host = renderTrack({
      track: { ...track, isMuted: true, isSoloed: false },
      onMuteChange,
      onSoloChange,
    });
    const muteButton = host.querySelector<HTMLButtonElement>('button[aria-label="Track Mute"]');
    const soloButton = host.querySelector<HTMLButtonElement>('button[aria-label="Track Solo"]');

    await act(async () => {
      muteButton?.click();
      soloButton?.click();
    });

    expect(muteButton?.getAttribute('aria-pressed')).toBe('true');
    expect(soloButton?.getAttribute('aria-pressed')).toBe('false');
    expect(onMuteChange).toHaveBeenCalledWith(false);
    expect(onSoloChange).toHaveBeenCalledWith(true);
  });

  it('Mute 처리 중 중복 클릭을 막는다', async () => {
    const muteResult = createDeferred<TrackToggleResult>();
    const onMuteChange = vi.fn(() => muteResult.promise);
    const host = renderTrack({ onMuteChange });
    const muteButton = host.querySelector<HTMLButtonElement>('button[aria-label="Track Mute"]');

    act(() => muteButton?.click());
    act(() => muteButton?.click());

    expect(onMuteChange).toHaveBeenCalledTimes(1);
    expect(muteButton?.disabled).toBe(true);

    await act(async () => muteResult.resolve('failed'));

    expect(muteButton?.disabled).toBe(false);
  });
});
