import { useState, useCallback, useMemo } from 'react';
import type { Message, AgentStatus } from '@/types/agent';
import { useWebLLM } from '@/hooks/agent/useWebLLM';
import { useTrackStore } from '@/stores/useTrackStore';
import { useAudioCommand } from '@/logics/audio';
import { handleAIResponse } from '@/hooks/agent/useAgent/utils/aiResponseHandler';
import {
  createUserMessage,
  createAssistantMessage,
} from '@/hooks/agent/useAgent/utils/messageHelpers';
import { trackChatMessageSent } from '@/utils/analytics';

export function useAgent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<AgentStatus>('idle');

  const { engine } = useWebLLM();
  const trackMap = useTrackStore(state => state.tracks);

  const tracks = useMemo(
    () =>
      Array.from(trackMap.values()).map((track, index) => ({
        id: track.id,
        index,
        regions: track.regions.map(r => ({
          id: r.id,
          startTime: r.startTime,
          endTime: r.endTime,
        })),
      })),
    [trackMap]
  );
  const { execute } = useAudioCommand();

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  /** @todo(@steinjun0): 좀 더 로직 응집도를 높여야함. updateMessage가 현 단계에서 G필수인지도 고민 필요 */
  const updateMessage = useCallback((id: string, content: string) => {
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, content } : m)));
  }, []);

  const sendMessage = async (content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    if (!engine) {
      alert('Engine not initialized');
      console.error('[Agent] Engine not initialized');
      return;
    }

    // Google Analytics: 사용자 메시지 전송 추적 (프롬프트 개선을 위해 실제 내용 포함)
    trackChatMessageSent(trimmedContent.length, trimmedContent);

    // 사용자 메시지 추가
    const userMsg = createUserMessage(trimmedContent);
    addMessage(userMsg);
    setStatus('generating');

    // 어시스턴트 메시지 생성 및 추가
    const assistantMsg = createAssistantMessage();
    addMessage(assistantMsg);

    // AI 응답 처리
    const startTime = Date.now();
    const {
      message,
      status: newStatus,
      parsedCommands,
      executionResults,
    } = await handleAIResponse({
      engine,
      tracks,
      userInput: trimmedContent,
      execute,
    });
    const responseTime = Date.now() - startTime;

    // Google Analytics: AI 응답 수신 추적 (프롬프트 개선을 위해 실제 내용 포함)
    if (message) {
      const { trackAIResponseReceived, trackPromptImprovementSession } =
        await import('@/utils/analytics');
      trackAIResponseReceived(
        message.length,
        responseTime,
        message,
        parsedCommands ?? []
      );

      // 프롬프트 개선을 위한 전체 세션 추적
      if (parsedCommands && executionResults) {
        trackPromptImprovementSession({
          userInput: trimmedContent,
          aiResponse: message,
          parsedCommands,
          executionResults,
          responseTime,
        });
      }
    }

    updateMessage(assistantMsg.id, message);
    setStatus(newStatus);
  };

  return { messages, status, sendMessage, addMessage, updateMessage };
}
