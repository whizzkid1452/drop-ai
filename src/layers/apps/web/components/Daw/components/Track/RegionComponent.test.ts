// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeAudioSource } from '@/layers/audio-source-registry/i-audio-source-registry';
import type { RegionState } from '@/layers/session/session';
import { RegionComponent } from './RegionComponent';
import { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import type { TimelineGridSettings } from '../../timeline-grid';

const { renderWaveSurferPlayer, resolveAudioSource } = vi.hoisted(() => ({
  renderWaveSurferPlayer: vi.fn(),
  resolveAudioSource: vi.fn<(sourceId: string) => RuntimeAudioSource | null>(),
}));

vi.mock('@wavesurfer/react', () => ({
  default: (props: {
    duration?: number;
    height?: number | 'auto';
    peaks?: Array<Float32Array | number[]>;
    url: string;
  }) => {
    renderWaveSurferPlayer(props);
    return createElement('div', { 'data-audio-url': props.url });
  },
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAudioSourceResolver: () => ({
    resolve: resolveAudioSource,
    listCommittedMetadata: () => [],
  }),
}));

vi.mock('./RegionComponent.css.ts', () => ({
  endTrimHandle: 'endTrimHandle',
  regionContainer: 'regionContainer',
  removeButton: 'removeButton',
  selectedRegion: 'selectedRegion',
  startTrimHandle: 'startTrimHandle',
  trimHandle: 'trimHandle',
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

interface RenderRegionOptions {
  gridSettings?: TimelineGridSettings;
  onMove: (newStartTime: number) => Promise<void>;
  onRemove?: () => void;
  onSelect?: (additive: boolean) => void;
  onTrim?: (request: {
    durationSeconds: number;
    sourceStartTimeSeconds: number;
    startTimeSeconds: number;
  }) => Promise<void>;
  region?: RegionState;
  selected?: boolean;
  waveformRenderData?: {
    duration: number;
    objectUrl: string;
    peaks: Array<Float32Array | number[]>;
  };
}

interface PointerOptions {
  button?: number;
  clientX?: number;
  isPrimary?: boolean;
  pointerId?: number;
}

const mountedRoots: Root[] = [];
const coordinateMapper = new TimelineCoordinateMapper({
  tempoBpm: 120,
  beatsPerBar: 4,
  beatUnit: 4,
  pixelsPerQuarterNote: 50,
});
const gridSettings = { division: 'beat', snapMode: 'off' } as const;
const sourceId = '41e673bf-5467-4d36-a716-2d80a76ac82f';
const sourceBackedRegion: RegionState = {
  id: 'region-1',
  startTime: 2,
  endTime: 5,
  sourceStartTime: 0,
  duration: 3,
  status: [],
  sourceId,
};

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function renderRegion({
  gridSettings: selectedGridSettings = gridSettings,
  onMove,
  onRemove,
  onSelect,
  onTrim,
  region = sourceBackedRegion,
  selected = false,
  waveformRenderData,
}: RenderRegionOptions) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);

  act(() => {
    root.render(
      createElement(RegionComponent, {
        region,
        coordinateMapper,
        gridSettings: selectedGridSettings,
        onMove,
        onRemove,
        onSelect,
        onTrim,
        selected,
        waveformRenderData,
      })
    );
  });

  const regionElement = host.firstElementChild;
  if (!(regionElement instanceof HTMLDivElement)) {
    throw new Error('Region 요소를 찾지 못했습니다.');
  }

  [regionElement, ...host.querySelectorAll<HTMLElement>('button')].forEach(element => {
    const capturedPointerIds = new Set<number>();
    element.setPointerCapture = pointerId => capturedPointerIds.add(pointerId);
    element.hasPointerCapture = pointerId => capturedPointerIds.has(pointerId);
    element.releasePointerCapture = pointerId => capturedPointerIds.delete(pointerId);
  });

  return { host, regionElement, root };
}

function dispatchPointer(
  element: Element,
  type: 'pointercancel' | 'pointerdown' | 'pointermove' | 'pointerup',
  { button = 0, clientX = 100, isPrimary = true, pointerId = 1 }: PointerOptions = {}
) {
  act(() => {
    element.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button,
        clientX,
        isPrimary,
        pointerId,
      })
    );
  });
}

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
  resolveAudioSource.mockReset();
  renderWaveSurferPlayer.mockReset();
});

describe('RegionComponent 오디오 소스', () => {
  it('원본 시작점이 이동한 Region도 오류 문구를 파형 offset 밖에 표시한다', () => {
    const { host, regionElement } = renderRegion({
      region: { ...sourceBackedRegion, sourceStartTime: 2 },
      onMove: vi.fn().mockResolvedValue(undefined),
    });
    const alert = host.querySelector('[role="alert"]');

    expect(alert?.parentElement).toBe(regionElement);
  });

  it('sourceId Region이 실제 Region에 연결되어 있으면 Object URL을 WaveSurfer에 전달한다', () => {
    resolveAudioSource.mockReturnValue({
      metadata: {
        id: sourceId,
        fileName: 'source.wav',
        mimeType: 'audio/wav',
        byteLength: 100,
        durationSeconds: 3,
      },
      objectUrl: 'blob:source',
      isCommitted: true,
      regionIds: [sourceBackedRegion.id],
    });

    const { host } = renderRegion({
      region: sourceBackedRegion,
      onMove: vi.fn().mockResolvedValue(undefined),
    });

    expect(resolveAudioSource).toHaveBeenCalledWith(sourceBackedRegion.sourceId);
    expect(host.querySelector('[data-audio-url="blob:source"]')).not.toBeNull();
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('Track 높이에 맞춰 파형 전체를 렌더링한다', () => {
    resolveAudioSource.mockReturnValue({
      metadata: {
        id: sourceId,
        fileName: 'source.wav',
        mimeType: 'audio/wav',
        byteLength: 100,
        durationSeconds: 3,
      },
      objectUrl: 'blob:source',
      isCommitted: true,
      regionIds: [sourceBackedRegion.id],
    });

    renderRegion({
      region: sourceBackedRegion,
      onMove: vi.fn().mockResolvedValue(undefined),
    });

    expect(renderWaveSurferPlayer).toHaveBeenCalledWith(expect.objectContaining({ height: 74 }));
  });

  it('같은 runtime source의 캐시된 파형 데이터를 WaveSurfer에 전달한다', () => {
    const peaks = [new Float32Array([0, 0.5, -0.5])];
    resolveAudioSource.mockReturnValue({
      metadata: {
        id: sourceId,
        fileName: 'source.wav',
        mimeType: 'audio/wav',
        byteLength: 100,
        durationSeconds: 3,
      },
      objectUrl: 'blob:source',
      isCommitted: true,
      regionIds: [sourceBackedRegion.id],
    });

    renderRegion({
      region: sourceBackedRegion,
      onMove: vi.fn().mockResolvedValue(undefined),
      waveformRenderData: {
        duration: 3,
        objectUrl: 'blob:source',
        peaks,
      },
    });

    expect(renderWaveSurferPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 3,
        peaks,
        url: 'blob:source',
      })
    );
  });

  it('마운트 후 생성된 캐시는 기존 WaveSurfer의 options를 바꾸지 않는다', () => {
    const peaks = [new Float32Array([0, 0.5, -0.5])];
    resolveAudioSource.mockReturnValue({
      metadata: {
        id: sourceId,
        fileName: 'source.wav',
        mimeType: 'audio/wav',
        byteLength: 100,
        durationSeconds: 3,
      },
      objectUrl: 'blob:source',
      isCommitted: true,
      regionIds: [sourceBackedRegion.id],
    });
    const onMove = vi.fn().mockResolvedValue(undefined);
    const { root } = renderRegion({
      region: sourceBackedRegion,
      onMove,
    });
    renderWaveSurferPlayer.mockClear();

    act(() => {
      root.render(
        createElement(RegionComponent, {
          region: sourceBackedRegion,
          coordinateMapper,
          gridSettings,
          onMove,
          waveformRenderData: {
            duration: 3,
            objectUrl: 'blob:source',
            peaks,
          },
        })
      );
    });

    expect(renderWaveSurferPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: undefined,
        peaks: undefined,
      })
    );
  });

  it('runtime source URL이 바뀌면 이전 source의 캐시를 사용하지 않는다', () => {
    const oldPeaks = [new Float32Array([0, 0.5, -0.5])];
    const onMove = vi.fn().mockResolvedValue(undefined);
    resolveAudioSource.mockReturnValue({
      metadata: {
        id: sourceId,
        fileName: 'source.wav',
        mimeType: 'audio/wav',
        byteLength: 100,
        durationSeconds: 3,
      },
      objectUrl: 'blob:old-source',
      isCommitted: true,
      regionIds: [sourceBackedRegion.id],
    });
    const { root } = renderRegion({
      region: sourceBackedRegion,
      onMove,
      waveformRenderData: {
        duration: 3,
        objectUrl: 'blob:old-source',
        peaks: oldPeaks,
      },
    });
    renderWaveSurferPlayer.mockClear();
    resolveAudioSource.mockReturnValue({
      metadata: {
        id: sourceId,
        fileName: 'source.wav',
        mimeType: 'audio/wav',
        byteLength: 100,
        durationSeconds: 3,
      },
      objectUrl: 'blob:new-source',
      isCommitted: true,
      regionIds: [sourceBackedRegion.id],
    });

    act(() => {
      root.render(
        createElement(RegionComponent, {
          region: sourceBackedRegion,
          coordinateMapper,
          gridSettings,
          onMove,
        })
      );
    });

    expect(renderWaveSurferPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: undefined,
        peaks: undefined,
        url: 'blob:new-source',
      })
    );
  });

  it.each([
    { label: '등록된 소스가 없을 때', resolvedSource: null },
    {
      label: '소스와 Region 연결이 일치하지 않을 때',
      resolvedSource: {
        metadata: {
          id: sourceId,
          fileName: 'source.wav',
          mimeType: 'audio/wav',
          byteLength: 100,
          durationSeconds: 3,
        },
        objectUrl: 'blob:source',
        isCommitted: true,
        regionIds: ['another-region'],
      },
    },
  ])('$label 접근 가능한 오류를 표시한다', ({ resolvedSource }) => {
    resolveAudioSource.mockReturnValue(resolvedSource);

    const { host } = renderRegion({
      region: sourceBackedRegion,
      onMove: vi.fn().mockResolvedValue(undefined),
    });

    expect(host.querySelector('[data-audio-url]')).toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('오디오 소스를 찾을 수 없습니다.');
  });
});

describe('RegionComponent 드래그 이동', () => {
  it('이동 중에는 미리보기만 바꾸고 포인터를 놓을 때 한 번 실행한다', async () => {
    const onMove = vi.fn<(newStartTime: number) => Promise<void>>().mockResolvedValue(undefined);
    const { regionElement } = renderRegion({ onMove });

    dispatchPointer(regionElement, 'pointerdown', { clientX: 100 });
    dispatchPointer(regionElement, 'pointermove', { clientX: 150 });

    expect(onMove).not.toHaveBeenCalled();
    expect(regionElement.style.transform).toBe('translateX(250px)');

    dispatchPointer(regionElement, 'pointerup', { clientX: 150 });
    await act(async () => Promise.resolve());

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(2.5);
  });

  it('실행이 끝날 때까지 미리보기를 유지하고 실패하면 원래 위치로 돌아간다', async () => {
    const moveResult = createDeferred<void>();
    const { regionElement } = renderRegion({ onMove: () => moveResult.promise });

    dispatchPointer(regionElement, 'pointerdown', { clientX: 100 });
    dispatchPointer(regionElement, 'pointermove', { clientX: 150 });
    dispatchPointer(regionElement, 'pointerup', { clientX: 150 });

    expect(regionElement.style.transform).toBe('translateX(250px)');
    expect(regionElement.style.cursor).toBe('wait');

    await act(async () => moveResult.reject(new Error('이동 실패')));

    expect(regionElement.style.transform).toBe('translateX(200px)');
    expect(regionElement.style.cursor).toBe('grab');
  });

  it('Grid Snap이 켜져 있으면 이동 위치를 가장 가까운 박자에 맞춘다', async () => {
    const onMove = vi.fn<(newStartTime: number) => Promise<void>>().mockResolvedValue(undefined);
    const { regionElement } = renderRegion({
      gridSettings: { division: 'beat', snapMode: 'grid' },
      onMove,
    });

    dispatchPointer(regionElement, 'pointerdown', { clientX: 100 });
    dispatchPointer(regionElement, 'pointerup', { clientX: 130 });
    await act(async () => Promise.resolve());

    expect(onMove).toHaveBeenCalledWith(2.5);
  });

  it('삭제 버튼을 조작해도 이동을 실행하지 않는다', () => {
    const onMove = vi.fn<(newStartTime: number) => Promise<void>>().mockResolvedValue(undefined);
    const onRemove = vi.fn();
    const { host } = renderRegion({ onMove, onRemove });
    const removeButton = host.querySelector('button');
    if (!removeButton) {
      throw new Error('Region 삭제 버튼을 찾지 못했습니다.');
    }

    dispatchPointer(removeButton, 'pointerdown');
    dispatchPointer(removeButton, 'pointerup');
    act(() => removeButton.click());

    expect(onMove).not.toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('포인터 입력이 취소되면 이동하지 않고 원래 위치로 돌아간다', () => {
    const onMove = vi.fn<(newStartTime: number) => Promise<void>>().mockResolvedValue(undefined);
    const { regionElement } = renderRegion({ onMove });

    dispatchPointer(regionElement, 'pointerdown', { clientX: 100 });
    dispatchPointer(regionElement, 'pointermove', { clientX: 150 });
    dispatchPointer(regionElement, 'pointercancel', { clientX: 150 });

    expect(onMove).not.toHaveBeenCalled();
    expect(regionElement.style.transform).toBe('translateX(200px)');
  });

  it.each([
    { button: 2, isPrimary: true, label: '보조 버튼' },
    { button: 0, isPrimary: false, label: '주 포인터가 아닌 입력' },
  ])('$label으로는 이동을 시작하지 않는다', ({ button, isPrimary }) => {
    const onMove = vi.fn<(newStartTime: number) => Promise<void>>().mockResolvedValue(undefined);
    const { regionElement } = renderRegion({ onMove });

    dispatchPointer(regionElement, 'pointerdown', { button, isPrimary, clientX: 100 });
    dispatchPointer(regionElement, 'pointermove', { button, isPrimary, clientX: 150 });
    dispatchPointer(regionElement, 'pointerup', { button, isPrimary, clientX: 150 });

    expect(onMove).not.toHaveBeenCalled();
    expect(regionElement.style.transform).toBe('translateX(200px)');
  });
});

describe('RegionComponent 선택과 trim', () => {
  it('포인터 입력 시 단일 또는 추가 선택을 요청하고 선택 상태를 표시한다', () => {
    const onSelect = vi.fn();
    const { regionElement } = renderRegion({
      onMove: vi.fn().mockResolvedValue(undefined),
      onSelect,
      selected: true,
    });

    dispatchPointer(regionElement, 'pointerdown');
    dispatchPointer(regionElement, 'pointerup');
    act(() =>
      regionElement.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: true, isPrimary: true, pointerId: 2 })
      )
    );

    expect(onSelect).toHaveBeenNthCalledWith(1, false);
    expect(onSelect).toHaveBeenNthCalledWith(2, true);
    expect(regionElement.dataset.selected).toBe('true');
  });

  it('왼쪽 trim handle은 Timeline과 Source 시작을 함께 이동하고 길이를 줄인다', async () => {
    const onMove = vi.fn().mockResolvedValue(undefined);
    const onTrim = vi.fn().mockResolvedValue(undefined);
    const { host } = renderRegion({ onMove, onTrim });
    const handle = host.querySelector('[aria-label="Region 시작 trim"]');
    if (!handle) {
      throw new Error('시작 trim handle을 찾지 못했습니다.');
    }

    dispatchPointer(handle, 'pointerdown', { clientX: 100, pointerId: 3 });
    dispatchPointer(handle, 'pointerup', { clientX: 150, pointerId: 3 });
    await act(async () => Promise.resolve());

    expect(onTrim).toHaveBeenCalledWith({
      durationSeconds: 2.5,
      sourceStartTimeSeconds: 0.5,
      startTimeSeconds: 2.5,
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('오른쪽 trim handle은 Timeline 시작과 Source 시작을 유지하고 길이만 바꾼다', async () => {
    const onTrim = vi.fn().mockResolvedValue(undefined);
    const { host } = renderRegion({ onMove: vi.fn().mockResolvedValue(undefined), onTrim });
    const handle = host.querySelector('[aria-label="Region 끝 trim"]');
    if (!handle) {
      throw new Error('끝 trim handle을 찾지 못했습니다.');
    }

    dispatchPointer(handle, 'pointerdown', { clientX: 100, pointerId: 4 });
    dispatchPointer(handle, 'pointerup', { clientX: 150, pointerId: 4 });
    await act(async () => Promise.resolve());

    expect(onTrim).toHaveBeenCalledWith({
      durationSeconds: 3.5,
      sourceStartTimeSeconds: 0,
      startTimeSeconds: 2,
    });
  });
});
