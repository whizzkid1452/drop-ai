import { describe, expect, it } from 'vitest';
import type { Message } from '@/types/agent';
import { AgentRuntimeController } from '../controllers/agent-runtime-controller';
import { createSessionStore } from '../session/session';
import { AgentRuntimeCommandExecutor, AgentRuntimeCommandType } from './agent-runtime-command-executor';

function createTestRuntime() {
  const sessionStore = createSessionStore({
    initialProjectMetadata: {
      id: '11111111-1111-4111-8111-111111111111',
      name: '테스트 프로젝트',
      revision: 0,
    },
  });
  const executor = new AgentRuntimeCommandExecutor(new AgentRuntimeController(sessionStore));
  return { executor, sessionStore };
}

describe('AgentRuntimeCommandExecutor', () => {
  it('모델 상태 변경을 Controller를 거쳐 Session에 반영한다', () => {
    const { executor, sessionStore } = createTestRuntime();
    executor.execute({ status: 'ready', type: AgentRuntimeCommandType.SET_MODEL_STATUS });
    expect(sessionStore.getState().agentModelStatus).toBe('ready');
  });

  it('모델 로딩 진행률을 Controller를 거쳐 Session에 반영한다', () => {
    const { executor, sessionStore } = createTestRuntime();
    executor.execute({ progress: 0.5, text: '모델 준비 중', type: AgentRuntimeCommandType.SET_LOADING_PROGRESS });
    expect(sessionStore.getState()).toMatchObject({ modelLoadingProgress: 0.5, modelLoadingText: '모델 준비 중' });
  });

  it('메시지 추가와 변경을 Controller를 거쳐 Session에 반영한다', () => {
    const { executor, sessionStore } = createTestRuntime();
    const message: Message = { content: '요청', id: 'message-1', role: 'user', timestamp: Date.now() };
    executor.execute({ message, type: AgentRuntimeCommandType.ADD_MESSAGE });
    executor.execute({ content: '변경', id: message.id, type: AgentRuntimeCommandType.UPDATE_MESSAGE });
    expect(sessionStore.getState().agentMessages[0]?.content).toBe('변경');
  });

  it('실행 상태 변경을 Controller를 거쳐 Session에 반영한다', () => {
    const { executor, sessionStore } = createTestRuntime();
    executor.execute({ status: 'executing', type: AgentRuntimeCommandType.SET_STATUS });
    executor.execute({ status: 'running', type: AgentRuntimeCommandType.SET_RUN_STATUS });
    expect(sessionStore.getState()).toMatchObject({ agentRunStatus: 'running', agentStatus: 'executing' });
  });

  it('성공 결과와 workflow 초기화를 Controller를 거쳐 Session에 반영한다', () => {
    const { executor, sessionStore } = createTestRuntime();
    executor.execute({ type: AgentRuntimeCommandType.MARK_RESULT_SUCCESSFUL });
    expect(sessionStore.getState().hasSuccessfulAgentResult).toBe(true);
    executor.execute({ type: AgentRuntimeCommandType.RESET_WORKFLOW });
    expect(sessionStore.getState().hasSuccessfulAgentResult).toBe(false);
  });
});
