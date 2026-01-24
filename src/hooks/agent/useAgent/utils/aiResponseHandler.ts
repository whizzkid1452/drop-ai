import {
  parseAudioCommandString,
  type AudioCommand,
  AudioCommandType,
} from '@/types/audioCommand.schema';
import { queryToLLM as queryToLLM } from './queryToLLM';

export interface AIResponseHandlerDependencies {
  execute: (command: AudioCommand) => Promise<any>;
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
  const { engine, trackCount, userInput, execute } = deps;

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

  const { commands, error } = parseAudioCommandString({
    commandString: fullResponse,
  });

  if (commands && commands.length > 0) {
    // Execute all commands sequentially
    for (const command of commands) {
      if (command.type === AudioCommandType.GET_TRACK_INFO) {
        // 엔진을 거치지 않고 핸들러 레벨에서 정보 처리 (필요시 추가 로직 구현)
        console.log('[aiResponseHandler] GET_TRACK_INFO requested');
      } else {
        await execute(command);
      }
    }
    return {
      message: fullResponse || '✅ Commands executed',
      status: 'idle' as const,
    };
  }

  return {
    message: fullResponse || 'no response',
    status: error ? 'error' : 'idle',
  } as const;
}
