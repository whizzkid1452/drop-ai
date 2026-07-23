import { useCallback, useMemo } from 'react';
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
import { resolveAgentRunStatus } from './utils/resolve-agent-run-status';

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
    pluginInstances: track.pluginInstances.map(clonePluginInstance),
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
  const { engine } = useWebLLM();
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

  const sendMessage = async (content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    if (!engine) {
      alert('Engine not initialized');
      console.error('[Agent] Engine not initialized');
      setAgentStatus('error');
      setAgentRunStatus('failed');
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
      const errorMessage = error instanceof Error ? error.message : 'Agent request failed';
      updateMessage(assistantMsg.id, errorMessage);
      setAgentStatus('error');
      setAgentRunStatus('failed');
      console.error('[Agent] Failed to process message:', error);
    }
  };

  return { messages, status, sendMessage, addMessage, updateMessage };
}
