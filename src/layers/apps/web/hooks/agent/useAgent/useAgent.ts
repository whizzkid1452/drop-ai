import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Message } from '@/types/agent';
import { useWebLLM } from '@/layers/apps/web/hooks/agent/useWebLLM';
import { useAudioSourceResolver, useCommandExecutor, useSession } from '@/layers/apps/web/context/layer-hooks';
import { downloadWebAudioCommandResults } from '@/layers/apps/web/utils/execute-web-audio-command';
import { handleAIResponse } from '@/layers/apps/web/hooks/agent/useAgent/utils/aiResponseHandler';
import { createUserMessage, createAssistantMessage } from '@/layers/apps/web/hooks/agent/useAgent/utils/messageHelpers';
import { trackAIResponseReceived, trackChatMessageSent, trackPromptImprovementSession } from '@/utils/analytics';
import type { AudioCommand } from '@/types/audioCommand.schema';
import type { IAudioSourceResolver } from '@/layers/audio-source-registry/i-audio-source-registry';
import type { RegionState, TrackState } from '@/layers/session/session';
import type { PluginCatalogEntry, PluginInstanceState } from '@/types/plugin-state';
import type { AgentPromptPlugin, AgentPromptTrack } from './utils/getSystemPrompt';
import { isAgentRequestCancelledError } from './utils/agent-request-cancelled-error';
import { resolveAgentRunStatus } from './utils/resolve-agent-run-status';

interface ActiveAgentRequest {
  abortController: AbortController;
  assistantMessageId: string;
  phase: 'generating' | 'executing';
}

function hasAvailableAudioSource(region: RegionState, audioSourceResolver: IAudioSourceResolver): boolean {
  const audioSource = audioSourceResolver.resolve(region.sourceId);
  return audioSource?.regionIds.includes(region.id) ?? false;
}

function clonePluginInstance(instance: PluginInstanceState): PluginInstanceState {
  return {
    ...instance,
    manifestSummary: { ...instance.manifestSummary },
    parameters: instance.parameters.map(parameter => ({ ...parameter })),
  };
}

function clonePluginCatalogEntry(plugin: PluginCatalogEntry): AgentPromptPlugin {
  return {
    ...plugin,
    parameters: plugin.parameters.map(parameter =>
      parameter.type === 'enum'
        ? { ...parameter, options: parameter.options.map(option => ({ ...option })) }
        : { ...parameter }
    ),
  };
}

export function createAgentPromptPlugins(pluginCatalog: ReadonlyMap<string, PluginCatalogEntry>): AgentPromptPlugin[] {
  return Array.from(pluginCatalog.values(), clonePluginCatalogEntry);
}

export function createAgentPromptTracks(
  trackMap: ReadonlyMap<string, TrackState>,
  audioSourceResolver: IAudioSourceResolver
): AgentPromptTrack[] {
  return Array.from(trackMap.values()).map((track, index) => ({
    id: track.id,
    index,
    name: track.name,
    pluginInstances: track.pluginInstances.map(clonePluginInstance),
    loopSlots: (track.loopSlots ?? []).map(loopSlot => ({
      id: loopSlot.id,
      lengthBars: loopSlot.lengthBars,
      overdubSourceIds: [...loopSlot.overdubSourceIds],
      quantizationBars: loopSlot.quantizationBars,
      sourceId: loopSlot.sourceId,
      state: loopSlot.state,
    })),
    regions: track.regions.map(region => ({
      id: region.id,
      startTime: region.startTime,
      endTime: region.endTime,
      sourceStartTime: region.sourceStartTime,
      duration: region.duration,
      sourceId: region.sourceId,
      hasAudioSource: hasAvailableAudioSource(region, audioSourceResolver),
    })),
  }));
}

export function useAgent() {
  const { engine, interruptGeneration } = useWebLLM();
  const audioSourceResolver = useAudioSourceResolver();
  const trackMap = useSession(state => state.tracks);
  const pluginCatalog = useSession(state => state.pluginCatalog);
  const messages = useSession(state => state.agentMessages);
  const status = useSession(state => state.agentStatus);
  const addAgentMessage = useSession(state => state.addAgentMessage);
  const updateAgentMessage = useSession(state => state.updateAgentMessage);
  const setAgentStatus = useSession(state => state.setAgentStatus);
  const setAgentRunStatus = useSession(state => state.setAgentRunStatus);
  const markAgentResultSuccessful = useSession(state => state.markAgentResultSuccessful);
  const commandExecutor = useCommandExecutor();
  const activeAgentRequestRef = useRef<ActiveAgentRequest | null>(null);

  const tracks = useMemo(() => createAgentPromptTracks(trackMap, audioSourceResolver), [audioSourceResolver, trackMap]);
  const plugins = useMemo(() => createAgentPromptPlugins(pluginCatalog), [pluginCatalog]);

  const executeMany = useCallback(
    (commands: readonly AudioCommand[]) => commandExecutor.executeMany(commands),
    [commandExecutor]
  );

  const addMessage = useCallback(
    (message: Message) => {
      addAgentMessage(message);
    },
    [addAgentMessage]
  );

  const updateMessage = useCallback(
    (id: string, content: string) => {
      updateAgentMessage(id, content);
    },
    [updateAgentMessage]
  );

  const stopGeneration = useCallback(() => {
    const activeRequest = activeAgentRequestRef.current;
    if (!activeRequest || activeRequest.phase !== 'generating') {
      return;
    }

    activeAgentRequestRef.current = null;
    activeRequest.abortController.abort();
    try {
      interruptGeneration();
    } catch (error: unknown) {
      console.error('[Agent] Failed to interrupt generation:', error);
    }

    updateMessage(activeRequest.assistantMessageId, '응답 생성을 중지했습니다.');
    setAgentStatus('idle');
    setAgentRunStatus('cancelled');
  }, [interruptGeneration, setAgentRunStatus, setAgentStatus, updateMessage]);

  useEffect(
    () => () => {
      stopGeneration();
    },
    [stopGeneration]
  );

  const sendMessage = async (content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent || activeAgentRequestRef.current) return;

    if (!engine) {
      console.warn('[Agent] Message ignored because the model is not ready');
      return;
    }

    trackChatMessageSent({ messageLength: trimmedContent.length });

    // 사용자 메시지 추가
    const userMsg = createUserMessage(trimmedContent);
    addMessage(userMsg);
    setAgentStatus('generating');
    setAgentRunStatus('running');

    // 어시스턴트 메시지 생성 및 추가
    const assistantMsg = createAssistantMessage();
    addMessage(assistantMsg);
    const abortController = new AbortController();
    activeAgentRequestRef.current = {
      abortController,
      assistantMessageId: assistantMsg.id,
      phase: 'generating',
    };

    // AI 응답 처리
    try {
      const startTime = Date.now();
      const {
        message,
        status: newStatus,
        parsedCommands,
        executionResults,
        commandOutputs,
      } = await handleAIResponse({
        engine,
        plugins,
        tracks,
        userInput: trimmedContent,
        executeMany,
        signal: abortController.signal,
        onGenerationFinished: () => {
          const activeRequest = activeAgentRequestRef.current;
          if (activeRequest?.abortController !== abortController) {
            return;
          }

          activeRequest.phase = 'executing';
          setAgentStatus('executing');
        },
      });
      const responseTime = Date.now() - startTime;
      const commandTypes = (parsedCommands ?? []).map(command => command.type);

      trackAIResponseReceived({
        responseLength: message.length,
        responseTimeMs: responseTime,
        commandTypes,
      });

      if (parsedCommands && executionResults) {
        trackPromptImprovementSession({
          userInputLength: trimmedContent.length,
          aiResponseLength: message.length,
          commandTypes,
          executionResults: executionResults.map(result => ({
            commandType: result.commandType,
            success: result.success,
          })),
          responseTimeMs: responseTime,
        });
      }

      if (parsedCommands && commandOutputs) {
        downloadWebAudioCommandResults({ commands: parsedCommands, results: commandOutputs });
      }

      updateMessage(assistantMsg.id, message);
      setAgentStatus(newStatus);
      const agentRunStatus = resolveAgentRunStatus({
        responseStatus: newStatus,
        commandCount: parsedCommands?.length ?? 0,
        executionResults: executionResults ?? [],
      });
      setAgentRunStatus(agentRunStatus);
      if (agentRunStatus === 'succeeded') {
        markAgentResultSuccessful();
      }
    } catch (error) {
      if (isAgentRequestCancelledError(error)) {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Agent request failed';
      updateMessage(assistantMsg.id, errorMessage);
      setAgentStatus('error');
      setAgentRunStatus('failed');
      console.error('[Agent] Failed to process message:', error);
    } finally {
      if (activeAgentRequestRef.current?.abortController === abortController) {
        activeAgentRequestRef.current = null;
      }
    }
  };

  return { messages, status, sendMessage, stopGeneration, addMessage, updateMessage };
}
