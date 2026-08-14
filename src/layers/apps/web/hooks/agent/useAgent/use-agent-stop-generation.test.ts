// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentRequestCancelledError } from './utils/agent-request-cancelled-error';
import { useAgent } from './useAgent';
import { AgentRuntimeCommandType } from '@/layers/commands/agent-runtime-command-executor';

const mocks = vi.hoisted(() => {
  const sessionState = {
    tracks: new Map(),
    pluginCatalog: new Map(),
    agentMessages: [],
    agentStatus: 'idle',
  };

  return {
    sessionState,
    executeMany: vi.fn(),
    handleAIResponse: vi.fn(),
    interruptGeneration: vi.fn(),
    executeAgentRuntimeCommand: vi.fn(),
  };
});

vi.mock('@/layers/apps/web/hooks/agent/useWebLLM', () => ({
  useWebLLM: () => ({
    engine: {},
    interruptGeneration: mocks.interruptGeneration,
  }),
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAgentRuntimeCommands: () => ({ execute: mocks.executeAgentRuntimeCommand }),
  useAudioSourceResolver: () => ({
    resolve: () => null,
    listCommittedMetadata: () => [],
  }),
  useCommandExecutor: () => ({ executeMany: mocks.executeMany }),
  useSession: (selector: (state: typeof mocks.sessionState) => unknown) => selector(mocks.sessionState),
}));

vi.mock('./utils/aiResponseHandler', () => ({
  handleAIResponse: mocks.handleAIResponse,
}));

vi.mock('./utils/messageHelpers', () => ({
  createUserMessage: (content: string) => ({
    id: 'user-message',
    role: 'user',
    content,
    timestamp: 1,
  }),
  createAssistantMessage: () => ({
    id: 'assistant-message',
    role: 'assistant',
    content: 'Analyzing...',
    timestamp: 2,
  }),
}));

vi.mock('@/utils/analytics', () => ({
  trackAIResponseReceived: vi.fn(),
  trackChatMessageSent: vi.fn(),
  trackPromptImprovementSession: vi.fn(),
}));

const mountedRoots: Root[] = [];
let agentHookResult: ReturnType<typeof useAgent> | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function AgentHookProbe() {
  agentHookResult = useAgent();
  return null;
}

function getAgentHookResult(): ReturnType<typeof useAgent> {
  if (!agentHookResult) {
    throw new Error('Agent 훅이 렌더링되지 않았습니다.');
  }

  return agentHookResult;
}

beforeEach(() => {
  vi.clearAllMocks();
  agentHookResult = null;
});

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
});

describe('useAgent 생성 중단', () => {
  it('생성 중단 시 엔진을 중단하고 취소 상태와 안내 메시지를 기록한다', async () => {
    mocks.handleAIResponse.mockImplementationOnce(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new AgentRequestCancelledError()), { once: true });
        })
    );
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);
    act(() => root.render(createElement(AgentHookProbe)));

    let sendPromise: Promise<void> | undefined;
    act(() => {
      sendPromise = getAgentHookResult().sendMessage('재생해줘');
    });
    act(() => {
      getAgentHookResult().stopGeneration();
    });
    await act(async () => {
      await sendPromise;
    });

    expect(mocks.interruptGeneration).toHaveBeenCalledOnce();
    expect(mocks.executeAgentRuntimeCommand).toHaveBeenCalledWith({
      content: '응답 생성을 중지했습니다.',
      id: 'assistant-message',
      type: AgentRuntimeCommandType.UPDATE_MESSAGE,
    });
    expect(mocks.executeAgentRuntimeCommand).toHaveBeenCalledWith({
      status: 'idle',
      type: AgentRuntimeCommandType.SET_STATUS,
    });
    expect(mocks.executeAgentRuntimeCommand).toHaveBeenCalledWith({
      status: 'cancelled',
      type: AgentRuntimeCommandType.SET_RUN_STATUS,
    });
    expect(mocks.executeMany).not.toHaveBeenCalled();
  });

  it('중단 직후 새 요청을 받을 수 있다', async () => {
    mocks.handleAIResponse
      .mockImplementationOnce(
        ({ signal }: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new AgentRequestCancelledError()), { once: true });
          })
      )
      .mockResolvedValueOnce({
        message: '[]',
        status: 'idle',
        parsedCommands: [],
        executionResults: [],
        commandOutputs: [],
      });
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);
    act(() => root.render(createElement(AgentHookProbe)));

    let firstSendPromise: Promise<void> | undefined;
    let secondSendPromise: Promise<void> | undefined;
    act(() => {
      firstSendPromise = getAgentHookResult().sendMessage('첫 요청');
    });
    act(() => {
      getAgentHookResult().stopGeneration();
      secondSendPromise = getAgentHookResult().sendMessage('두 번째 요청');
    });
    await act(async () => {
      await Promise.all([firstSendPromise, secondSendPromise]);
    });

    expect(mocks.handleAIResponse).toHaveBeenCalledTimes(2);
  });
});
