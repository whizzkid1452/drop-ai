import {
  parseAudioCommandString,
  type AudioCommand,
} from '@/types/audioCommand.schema';
import { queryToLLM as queryToLLM } from './queryToLLM';

export interface AIResponseHandlerDependencies {
  handleAudioCommand: (command: AudioCommand) => Promise<any>;
  /** @todo engine 타입 추가 필요 */
  engine: any;
  trackCount: number;
  userInput: string;
}

/**
 * AI 응답을 처리하고 명령어를 실행하는 함수
 * @param deps 의존성 객체
 * @returns 처리 결과 (메시지 및 상태)
 */
export async function handleAIResponse(deps: AIResponseHandlerDependencies) {
  const { engine, trackCount, userInput, handleAudioCommand } = deps;

  const { fullResponse, error: llmResponseError } = await queryToLLM({
    engine,
    trackCount,
    userInput,
  });

  if (llmResponseError) {
    return {
      message: llmResponseError,
      status: 'error' as const,
    };
  }

  const { command, error } = parseAudioCommandString({
    commandString: fullResponse,
  });

  if (command) {
    await handleAudioCommand(command);
    return {
      message: fullResponse || '✅ Command executed',
      status: 'idle' as const,
    };
  }

  return {
    message: fullResponse || 'no response',
    status: error ? 'error' : 'idle',
  } as const;
}
