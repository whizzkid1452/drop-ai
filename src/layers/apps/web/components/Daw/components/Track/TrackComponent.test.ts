// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrackState } from '@/layers/session/session';
import type { TrackToggleResult } from '@/layers/apps/web/hooks/track-mute-solo-commands';
import type { TrackRemovalResult } from '@/layers/apps/web/hooks/track-action-commands';
import { TrackComponent } from './TrackComponent';

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useSession: (selector: (state: { currentTime: number }) => unknown) => selector({ currentTime: 0 }),
}));

vi.mock('@/layers/apps/web/hooks/useTrackActions', () => ({
  useTrackActions: () => ({
    moveRegion: vi.fn(),
    removeRegion: vi.fn(),
    splitRegion: vi.fn(),
  }),
}));

vi.mock('./RegionComponent', () => ({
  RegionComponent: () => null,
}));

vi.mock('./components/TrackPanController', () => ({
  TrackPanController: () => null,
}));

vi.mock('./components/TrackVolumeController', () => ({
  TrackVolumeController: () => null,
}));

vi.mock('./components/TrackRegionImportControl', async () => {
  const { createElement: createMockElement } = await import('react');

  return {
    TrackRegionImportControl: ({ onPendingChange }: { onPendingChange?: (isPending: boolean) => void }) =>
      createMockElement(
        'button',
        {
          'aria-label': 'Region 가져오기 시작',
          onClick: () => onPendingChange?.(true),
        },
        'Region 가져오기 시작'
      ),
  };
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

const mountedRoots: Root[] = [];
const track: TrackState = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '빈 Track',
  volume: 1,
  pan: 0,
  isMuted: false,
  isSoloed: false,
  status: [],
  regions: [],
};

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
});

describe('TrackComponent 제어', () => {
  it('오디오가 없는 Track도 삭제할 수 있고 처리 중 중복 실행을 막는다', async () => {
    const removalResult = createDeferred<TrackRemovalResult>();
    const onRemoveTrack = vi.fn(() => removalResult.promise);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => {
      root.render(
        createElement(TrackComponent, {
          mediaElement: null,
          track,
          pixelsPerSecond: 100,
          onReady: vi.fn(),
          onVolumeChange: vi.fn(),
          onPanChange: vi.fn(),
          onMuteChange: vi.fn().mockResolvedValue('updated'),
          onSoloChange: vi.fn().mockResolvedValue('updated'),
          onRemoveTrack,
        })
      );
    });

    const removeButton = host.querySelector<HTMLButtonElement>('button[aria-label="Track 삭제"]');
    if (!removeButton) {
      throw new Error('Track 삭제 버튼을 찾지 못했습니다.');
    }
    const muteButton = host.querySelector<HTMLButtonElement>('button[aria-label="Track Mute"]');
    const soloButton = host.querySelector<HTMLButtonElement>('button[aria-label="Track Solo"]');
    if (!muteButton || !soloButton) {
      throw new Error('Track Mute·Solo 버튼을 찾지 못했습니다.');
    }

    act(() => removeButton.click());
    act(() => removeButton.click());

    expect(onRemoveTrack).toHaveBeenCalledTimes(1);
    expect(removeButton.disabled).toBe(true);
    expect(muteButton.disabled).toBe(true);
    expect(soloButton.disabled).toBe(true);

    await act(async () => removalResult.resolve('cancelled'));

    expect(removeButton.disabled).toBe(false);
  });

  it('현재 Mute·Solo 상태를 표시하고 반대 상태를 요청한다', async () => {
    const onMuteChange = vi.fn().mockResolvedValue('updated');
    const onSoloChange = vi.fn().mockResolvedValue('updated');
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => {
      root.render(
        createElement(TrackComponent, {
          mediaElement: null,
          track: { ...track, isMuted: true, isSoloed: false },
          pixelsPerSecond: 100,
          onReady: vi.fn(),
          onVolumeChange: vi.fn(),
          onPanChange: vi.fn(),
          onMuteChange,
          onSoloChange,
          onRemoveTrack: vi.fn().mockResolvedValue('cancelled'),
        })
      );
    });

    const muteButton = host.querySelector<HTMLButtonElement>('button[aria-label="Track Mute"]');
    const soloButton = host.querySelector<HTMLButtonElement>('button[aria-label="Track Solo"]');
    if (!muteButton || !soloButton) {
      throw new Error('Track Mute·Solo 버튼을 찾지 못했습니다.');
    }

    expect(muteButton.getAttribute('aria-pressed')).toBe('true');
    expect(soloButton.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      muteButton.click();
      soloButton.click();
    });

    expect(onMuteChange).toHaveBeenCalledWith(false);
    expect(onSoloChange).toHaveBeenCalledWith(true);
  });

  it('Mute 처리 중 중복 클릭을 막고 실패하면 기존 표시를 유지한다', async () => {
    const muteResult = createDeferred<TrackToggleResult>();
    const onMuteChange = vi.fn(() => muteResult.promise);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => {
      root.render(
        createElement(TrackComponent, {
          mediaElement: null,
          track,
          pixelsPerSecond: 100,
          onReady: vi.fn(),
          onVolumeChange: vi.fn(),
          onPanChange: vi.fn(),
          onMuteChange,
          onSoloChange: vi.fn().mockResolvedValue('updated'),
          onRemoveTrack: vi.fn().mockResolvedValue('cancelled'),
        })
      );
    });

    const muteButton = host.querySelector<HTMLButtonElement>('button[aria-label="Track Mute"]');
    if (!muteButton) {
      throw new Error('Track Mute 버튼을 찾지 못했습니다.');
    }

    act(() => muteButton.click());
    act(() => muteButton.click());

    expect(onMuteChange).toHaveBeenCalledTimes(1);
    expect(onMuteChange).toHaveBeenCalledWith(true);
    expect(muteButton.disabled).toBe(true);

    await act(async () => muteResult.resolve('failed'));

    expect(muteButton.disabled).toBe(false);
    expect(muteButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('Solo 처리 중 중복 클릭을 막고 실패하면 기존 표시를 유지한다', async () => {
    const soloResult = createDeferred<TrackToggleResult>();
    const onSoloChange = vi.fn(() => soloResult.promise);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => {
      root.render(
        createElement(TrackComponent, {
          mediaElement: null,
          track: { ...track, isSoloed: true },
          pixelsPerSecond: 100,
          onReady: vi.fn(),
          onVolumeChange: vi.fn(),
          onPanChange: vi.fn(),
          onMuteChange: vi.fn().mockResolvedValue('updated'),
          onSoloChange,
          onRemoveTrack: vi.fn().mockResolvedValue('cancelled'),
        })
      );
    });

    const soloButton = host.querySelector<HTMLButtonElement>('button[aria-label="Track Solo"]');
    if (!soloButton) {
      throw new Error('Track Solo 버튼을 찾지 못했습니다.');
    }

    act(() => soloButton.click());
    act(() => soloButton.click());

    expect(onSoloChange).toHaveBeenCalledTimes(1);
    expect(onSoloChange).toHaveBeenCalledWith(false);
    expect(soloButton.disabled).toBe(true);

    await act(async () => soloResult.resolve('failed'));

    expect(soloButton.disabled).toBe(false);
    expect(soloButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('Region 가져오기 중에는 같은 Track의 Mute·Solo와 삭제를 막는다', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => {
      root.render(
        createElement(TrackComponent, {
          mediaElement: null,
          track,
          pixelsPerSecond: 100,
          onReady: vi.fn(),
          onVolumeChange: vi.fn(),
          onPanChange: vi.fn(),
          onMuteChange: vi.fn().mockResolvedValue('updated'),
          onSoloChange: vi.fn().mockResolvedValue('updated'),
          onRemoveTrack: vi.fn().mockResolvedValue('removed'),
        })
      );
    });

    const importButton = host.querySelector<HTMLButtonElement>('button[aria-label="Region 가져오기 시작"]');
    const muteButton = host.querySelector<HTMLButtonElement>('button[aria-label="Track Mute"]');
    const soloButton = host.querySelector<HTMLButtonElement>('button[aria-label="Track Solo"]');
    const removeButton = host.querySelector<HTMLButtonElement>('button[aria-label="Track 삭제"]');
    if (!importButton || !muteButton || !soloButton || !removeButton) {
      throw new Error('Track 제어 버튼을 찾지 못했습니다.');
    }

    act(() => importButton.click());

    expect(muteButton.disabled).toBe(true);
    expect(soloButton.disabled).toBe(true);
    expect(removeButton.disabled).toBe(true);
  });
});
