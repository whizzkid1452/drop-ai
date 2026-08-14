import { describe, expect, it } from 'vitest';
import { createIdleRenderJobState, isTerminalRenderJobStatus } from './render-job';

describe('RenderJobState', () => {
  it('초기 상태는 작업 식별자와 파일이 없는 idle 상태다', () => {
    expect(createIdleRenderJobState()).toEqual({
      completedFileCount: 0,
      errorMessage: null,
      jobId: null,
      outputFileCount: 0,
      progress: 0,
      stage: 'idle',
      status: 'idle',
    });
  });

  it.each(['completed', 'cancelled', 'failed'] as const)('%s 상태를 종료 상태로 판정한다', status => {
    expect(isTerminalRenderJobStatus(status)).toBe(true);
  });
});
