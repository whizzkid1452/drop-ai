// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrackState } from '@/layers/session/session';
import type { TrackRemovalResult } from '@/layers/apps/web/hooks/track-action-commands';
import { TrackComponent } from './TrackComponent';

vi.mock('@/layers/apps/web/context/LayerContext', () => ({
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

describe('TrackComponent 삭제', () => {
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
          onRemoveTrack,
        })
      );
    });

    const removeButton = host.querySelector<HTMLButtonElement>('button[aria-label="Track 삭제"]');
    if (!removeButton) {
      throw new Error('Track 삭제 버튼을 찾지 못했습니다.');
    }

    act(() => removeButton.click());
    act(() => removeButton.click());

    expect(onRemoveTrack).toHaveBeenCalledTimes(1);
    expect(removeButton.disabled).toBe(true);

    await act(async () => removalResult.resolve('cancelled'));

    expect(removeButton.disabled).toBe(false);
  });
});
