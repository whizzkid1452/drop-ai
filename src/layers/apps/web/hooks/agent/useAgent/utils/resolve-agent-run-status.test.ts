import { describe, expect, it } from 'vitest';
import { resolveAgentRunStatus } from './resolve-agent-run-status';

describe('resolveAgentRunStatus', () => {
  it('모든 명령이 성공하면 succeeded를 반환한다', () => {
    expect(
      resolveAgentRunStatus({
        responseStatus: 'idle',
        commandCount: 2,
        executionResults: [{ success: true }, { success: true }],
      })
    ).toBe('succeeded');
  });

  it('명령이 하나라도 실패하면 failed를 반환한다', () => {
    expect(
      resolveAgentRunStatus({
        responseStatus: 'idle',
        commandCount: 2,
        executionResults: [{ success: true }, { success: false }],
      })
    ).toBe('failed');
  });

  it('실행할 명령이 없으면 failed를 반환한다', () => {
    expect(
      resolveAgentRunStatus({
        responseStatus: 'idle',
        commandCount: 0,
        executionResults: [],
      })
    ).toBe('failed');
  });

  it('응답 처리 상태가 error이면 failed를 반환한다', () => {
    expect(
      resolveAgentRunStatus({
        responseStatus: 'error',
        commandCount: 1,
        executionResults: [{ success: true }],
      })
    ).toBe('failed');
  });
});
