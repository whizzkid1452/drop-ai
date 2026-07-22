// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RegionState } from '@/layers/session/session';
import { RegionComponent } from './RegionComponent';

vi.mock('@wavesurfer/react', () => ({
  default: () => null,
}));

vi.mock('./RegionComponent.css.ts', () => ({
  regionContainer: 'regionContainer',
  removeButton: 'removeButton',
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

interface RenderRegionOptions {
  onMove: (newStartTime: number) => Promise<void>;
  onRemove?: () => void;
}

interface PointerOptions {
  button?: number;
  clientX?: number;
  isPrimary?: boolean;
  pointerId?: number;
}

const mountedRoots: Root[] = [];
const region: RegionState = {
  id: 'region-1',
  startTime: 2,
  endTime: 5,
  sourceStartTime: 0,
  duration: 3,
  status: [],
  audioFileUrl: 'region.wav',
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

function renderRegion({ onMove, onRemove }: RenderRegionOptions) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);

  act(() => {
    root.render(
      createElement(RegionComponent, {
        region,
        pixelsPerSecond: 100,
        onMove,
        onRemove,
      })
    );
  });

  const regionElement = host.firstElementChild;
  if (!(regionElement instanceof HTMLDivElement)) {
    throw new Error('Region 요소를 찾지 못했습니다.');
  }

  const capturedPointerIds = new Set<number>();
  regionElement.setPointerCapture = pointerId => capturedPointerIds.add(pointerId);
  regionElement.hasPointerCapture = pointerId => capturedPointerIds.has(pointerId);
  regionElement.releasePointerCapture = pointerId => capturedPointerIds.delete(pointerId);

  return { host, regionElement };
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
