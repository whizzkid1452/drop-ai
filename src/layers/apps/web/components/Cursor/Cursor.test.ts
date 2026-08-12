// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Cursor } from './Cursor';
import { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';

const layerMocks = vi.hoisted(() => ({
  isPlaying: true,
  currentTime: 2,
  getCurrentTime: vi.fn().mockReturnValue(3),
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  usePlaybackClock: () => ({ getCurrentTime: layerMocks.getCurrentTime }),
  useSession: (selector: (state: { isPlaying: boolean; currentTime: number }) => unknown) =>
    selector({ isPlaying: layerMocks.isPlaying, currentTime: layerMocks.currentTime }),
}));

vi.mock('./Cursor.css.ts', () => ({ cursor: 'cursor' }));

const mountedRoots: Root[] = [];
const coordinateMapper = new TimelineCoordinateMapper({
  tempoBpm: 120,
  beatsPerBar: 4,
  beatUnit: 4,
  pixelsPerQuarterNote: 5,
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderCursor(timelineViewport: HTMLDivElement | null = null) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() =>
    root.render(
      createElement(Cursor, {
        coordinateMapper,
        followPlayhead: false,
        timelineViewportRef: { current: timelineViewport },
      })
    )
  );

  const cursor = host.querySelector<HTMLDivElement>('.cursor');
  if (!cursor) {
    throw new Error('재생 커서를 찾지 못했습니다.');
  }
  return cursor;
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  layerMocks.isPlaying = true;
  layerMocks.currentTime = 2;
  layerMocks.getCurrentTime.mockReset().mockReturnValue(3);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Cursor', () => {
  it('재생 중에는 읽기 전용 PlaybackClock으로 위치를 갱신한다', () => {
    let animationFrame: FrameRequestCallback | null = null;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        animationFrame = callback;
        return 1;
      })
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const cursor = renderCursor();

    act(() => animationFrame?.(0));

    expect(layerMocks.getCurrentTime).toHaveBeenCalledTimes(1);
    expect(cursor.style.transform).toBe('translateX(30px)');
  });

  it('정지 중에는 Session의 마지막 위치만 표시한다', () => {
    layerMocks.isPlaying = false;
    layerMocks.currentTime = 4;
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const cursor = renderCursor();

    expect(layerMocks.getCurrentTime).not.toHaveBeenCalled();
    expect(cursor.style.transform).toBe('translateX(40px)');
  });

  it('가로 스크롤로 Track 헤더 열에 들어간 플레이헤드를 숨긴다', () => {
    layerMocks.isPlaying = false;
    layerMocks.currentTime = 4;
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const timelineViewport = document.createElement('div');
    timelineViewport.scrollLeft = 50;

    const cursor = renderCursor(timelineViewport);

    expect(cursor.style.visibility).toBe('hidden');

    timelineViewport.scrollLeft = 30;
    act(() => timelineViewport.dispatchEvent(new Event('scroll')));

    expect(cursor.style.visibility).toBe('visible');
  });
});
