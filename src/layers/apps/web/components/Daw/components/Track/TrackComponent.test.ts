// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrackState } from '@/layers/session/session';
import { createDefaultRegionProcessingState } from '@/layers/shared/types/region-processing';
import type { TrackToggleResult } from '@/layers/apps/web/hooks/track-mute-solo-commands';
import { TrackComponent } from './TrackComponent';
import { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';

const { renderAutomationLaneEditor, renderRegionComponent } = vi.hoisted(() => ({
  renderAutomationLaneEditor: vi.fn(),
  renderRegionComponent: vi.fn(),
}));

vi.mock('@/layers/apps/web/hooks/useTrackActions', () => ({
  useTrackActions: () => ({
    moveRegion: vi.fn(),
    removeRegion: vi.fn(),
  }),
}));

vi.mock('./RegionComponent', () => ({
  RegionComponent: (props: unknown) => {
    renderRegionComponent(props);
    return null;
  },
}));

vi.mock('./AutomationLaneEditor', () => ({
  AutomationLaneEditor: (props: unknown) => {
    renderAutomationLaneEditor(props);
    return createElement('div', { 'data-testid': 'automation-lane-editor' });
  },
}));

vi.mock('../AudioLevelMeter/AudioLevelMeter', () => ({
  AudioLevelMeter: ({ label }: { label: string }) => createElement('div', { 'data-meter-label': label }),
}));

vi.mock('../LiveInputControls/TrackInputMonitoringControl', () => ({
  TrackInputMonitoringControl: ({ trackName }: { trackName: string }) =>
    createElement('button', { 'aria-label': `${trackName} 입력 모니터링` }),
}));

vi.mock('./components/TrackRecordArmControl', () => ({
  TrackRecordArmControl: ({ trackName }: { trackName: string }) =>
    createElement('button', { 'aria-label': `${trackName} 녹음 arm` }),
}));

vi.mock('./Track.css.ts', () => ({
  actionControls: 'actionControls',
  automationButtonActive: 'automationButtonActive',
  muteButtonActive: 'muteButtonActive',
  rangeSelection: 'rangeSelection',
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
    onFadeChange?: (regionId: string, edge: 'in' | 'out', durationSeconds: number) => Promise<void>;
    onMuteChange?: (muted: boolean) => Promise<TrackToggleResult>;
    onSelect?: () => void;
    onSoloChange?: (soloed: boolean) => Promise<TrackToggleResult>;
    onRegionSelect?: (regionId: string, additive: boolean) => void;
    onRangeSelect?: (startTimeSeconds: number, endTimeSeconds: number) => void;
    onTrimRegion?: (
      regionId: string,
      request: { durationSeconds: number; sourceStartTimeSeconds: number; startTimeSeconds: number }
    ) => Promise<void>;
    selectedRegionIds?: ReadonlySet<string>;
    selectedRange?: { endTimeSeconds: number; startTimeSeconds: number } | null;
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
        automationCapability: { blockers: [], status: 'available' },
        isSelected: options.isSelected ?? false,
        coordinateMapper,
        editPointSeconds: 0,
        gridSettings,
        onAutomationChange: vi.fn().mockResolvedValue(undefined),
        pluginCatalog: new Map(),
        routingGraph: { routes: [], sends: [] },
        trackNamesById: new Map([[track.id, track.name]]),
        waveformRenderCache,
        onReady: vi.fn(),
        onFadeChange: options.onFadeChange ?? vi.fn().mockResolvedValue(undefined),
        onMuteChange: options.onMuteChange ?? vi.fn().mockResolvedValue('updated'),
        onSelect: options.onSelect ?? vi.fn(),
        onSoloChange: options.onSoloChange ?? vi.fn().mockResolvedValue('updated'),
        onRegionSelect: options.onRegionSelect ?? vi.fn(),
        onRangeSelect: options.onRangeSelect ?? vi.fn(),
        onTrimRegion: options.onTrimRegion ?? vi.fn().mockResolvedValue(undefined),
        selectedRegionIds: options.selectedRegionIds ?? new Set(),
        selectedRange: options.selectedRange ?? null,
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
  renderRegionComponent.mockReset();
  renderAutomationLaneEditor.mockReset();
});

describe('TrackComponent 제어', () => {
  it('Automation 버튼으로 Lane 편집기를 바로 열고 닫는다', () => {
    const host = renderTrack();
    const automationButton = host.querySelector<HTMLButtonElement>(
      `button[aria-label="${track.name} Automation Lane 표시"]`
    );

    act(() => automationButton?.click());

    expect(automationButton?.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('[data-testid="automation-lane-editor"]')).not.toBeNull();
    expect(renderAutomationLaneEditor).toHaveBeenCalledTimes(1);

    act(() => automationButton?.click());

    expect(host.querySelector('[data-testid="automation-lane-editor"]')).toBeNull();
  });

  it('Track 제어부와 타임라인을 하나의 편집 행으로 렌더링한다', () => {
    const host = renderTrack();

    expect(host.querySelector(`article[aria-label="Track ${track.name}"]`)).not.toBeNull();
    expect(host.querySelector(`[aria-label="${track.name} timeline"]`)).not.toBeNull();
    expect(host.querySelector(`[aria-label="${track.name} 입력 모니터링"]`)).not.toBeNull();
    expect(host.querySelector(`[aria-label="${track.name} 녹음 arm"]`)).not.toBeNull();
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

  it('Region 선택 상태와 trim 요청을 Region UI에 연결한다', async () => {
    const selectedRegion = {
      ...createDefaultRegionProcessingState(),
      duration: 2,
      endTime: 3,
      id: '22222222-2222-4222-8222-222222222222',
      sourceId: '33333333-3333-4333-8333-333333333333',
      sourceStartTime: 0,
      startTime: 1,
      status: [],
    };
    const onRegionSelect = vi.fn();
    const onFadeChange = vi.fn().mockResolvedValue(undefined);
    const onTrimRegion = vi.fn().mockResolvedValue(undefined);
    renderTrack({
      onFadeChange,
      onRegionSelect,
      onTrimRegion,
      selectedRegionIds: new Set([selectedRegion.id]),
      track: { ...track, regions: [selectedRegion] },
    });
    const regionProps = renderRegionComponent.mock.calls[0]?.[0] as {
      onFadeChange: (edge: 'in' | 'out', durationSeconds: number) => Promise<void>;
      onSelect: (additive: boolean) => void;
      onTrim: (request: {
        durationSeconds: number;
        sourceStartTimeSeconds: number;
        startTimeSeconds: number;
      }) => Promise<void>;
      selected: boolean;
    };
    const trimRequest = { durationSeconds: 1, sourceStartTimeSeconds: 0.5, startTimeSeconds: 1.5 };

    regionProps.onSelect(true);
    await regionProps.onFadeChange('in', 0.25);
    await regionProps.onTrim(trimRequest);

    expect(regionProps.selected).toBe(true);
    expect(onRegionSelect).toHaveBeenCalledWith(selectedRegion.id, true);
    expect(onFadeChange).toHaveBeenCalledWith(selectedRegion.id, 'in', 0.25);
    expect(onTrimRegion).toHaveBeenCalledWith(selectedRegion.id, trimRequest);
  });

  it('빈 Timeline 드래그를 초 단위 Range 선택으로 전달하고 미리보기를 표시한다', () => {
    const onRangeSelect = vi.fn();
    const host = renderTrack({ onRangeSelect });
    const timeline = host.querySelector<HTMLElement>(`[aria-label="${track.name} timeline"]`);
    if (!timeline) {
      throw new Error('Track timeline을 찾지 못했습니다.');
    }
    const capturedPointers = new Set<number>();
    timeline.setPointerCapture = pointerId => capturedPointers.add(pointerId);
    timeline.hasPointerCapture = pointerId => capturedPointers.has(pointerId);
    timeline.releasePointerCapture = pointerId => capturedPointers.delete(pointerId);

    act(() => {
      timeline.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, isPrimary: true, pointerId: 7 })
      );
      timeline.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, button: 0, clientX: 250, isPrimary: true, pointerId: 7 })
      );
    });
    expect(host.querySelector('[data-testid="range-selection-preview"]')).not.toBeNull();

    act(() =>
      timeline.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 250, isPrimary: true, pointerId: 7 })
      )
    );

    expect(onRangeSelect).toHaveBeenCalledWith(1, 2.5);
  });
});
