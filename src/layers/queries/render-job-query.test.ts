import { describe, expect, it, vi } from 'vitest';
import { createIdleRenderJobState } from '../shared/types/render-job';
import { RenderJobQuery } from './render-job-query';

describe('RenderJobQuery', () => {
  it('같은 값의 state는 같은 참조로 반환하고 변경된 state는 새 값으로 반환한다', () => {
    let state = createIdleRenderJobState();
    const query = new RenderJobQuery({
      getRenderJobState: () => ({ ...state }),
      subscribeRenderJobState: vi.fn(() => vi.fn()),
    });

    const first = query.readState();
    expect(query.readState()).toBe(first);

    state = { ...state, jobId: 'job-1', outputFileCount: 1, stage: 'rendering', status: 'running' };
    expect(query.readState()).not.toBe(first);
  });

  it('runtime 구독을 UI listener에 연결한다', () => {
    const unsubscribe = vi.fn();
    const subscribeRenderJobState = vi.fn(() => unsubscribe);
    const query = new RenderJobQuery({
      getRenderJobState: createIdleRenderJobState,
      subscribeRenderJobState,
    });
    const listener = vi.fn();

    expect(query.subscribe(listener)).toBe(unsubscribe);
    expect(subscribeRenderJobState).toHaveBeenCalledWith(expect.any(Function));
  });
});
