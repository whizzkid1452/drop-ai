import type { AgentRunStatus, AgentStatus } from '@/types/agent';

interface ExecutionResult {
  success: boolean;
}

interface ResolveAgentRunStatusParams {
  responseStatus: AgentStatus;
  commandCount: number;
  executionResults: readonly ExecutionResult[];
}

export function resolveAgentRunStatus({
  responseStatus,
  commandCount,
  executionResults,
}: ResolveAgentRunStatusParams): AgentRunStatus {
  // 명령이 없으면 오디오가 변경되지 않았으므로 미리듣기 결과로 인정하지 않는다.
  if (responseStatus === 'error' || commandCount === 0) {
    return 'failed';
  }

  const didExecuteEveryCommand = executionResults.length === commandCount;
  const didEveryCommandSucceed = executionResults.every(result => result.success);

  return didExecuteEveryCommand && didEveryCommandSucceed ? 'succeeded' : 'failed';
}
