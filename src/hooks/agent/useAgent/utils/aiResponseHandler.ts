import type { Message } from '@/types/agent';
import { parseAICommand, type AudioCommand } from '@/types/audioCommand.schema';
import type { Track } from '@/types/track';
import { createAssistantMessage } from './messageHelpers';
import { queryToLLM } from './queryToLLM';

export interface AIResponseHandlerDependencies {
  handleAudioCommand: (command: AudioCommand) => Promise<any>;
  getTracks: () => Track[];
  /** @todo engine 타입 추가 필요 */
  engine: any; // WebLLM 엔진 타입
  trackCount: number;
  userInput: string;
  assistantMsgId: string;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, content: string) => void;
  setStatus: (status: 'idle' | 'error') => void;
}

/**
 * AI 응답을 처리하고 명령어를 실행하는 함수
 * @param deps 의존성 객체
 * @returns 성공 여부
 */
export async function handleAIResponse(
  deps: AIResponseHandlerDependencies
): Promise<boolean> {
  const {
    engine,
    trackCount,
    userInput,
    assistantMsgId,
    addMessage,
    updateMessage,
    setStatus,
    handleAudioCommand,
  } = deps;

  const { fullResponse, error: llmResponseError } = await queryToLLM({
    engine,
    trackCount,
    userInput,
  });
  if (llmResponseError) {
    updateMessage(assistantMsgId, llmResponseError);
    setStatus('error');
    return false;
  }

  console.log('[AI Raw Response]:', fullResponse);

  const { command, error } = parseAICommand(fullResponse);

  if (command) {
    console.log('[AI Command Execution]', command);
    await handleAudioCommand(command);
    addMessage(createAssistantMessage('✅ Command executed'));
  }

  updateMessage(assistantMsgId, fullResponse || 'no response');
  setStatus(error ? 'error' : 'idle');

  return true;
}
