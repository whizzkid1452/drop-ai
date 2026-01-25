import {
  parseAudioCommandString,
  type AudioCommand,
} from '@/types/audioCommand.schema';
import { queryToLLM as queryToLLM } from './queryToLLM';

export interface AIResponseHandlerDependencies {
  execute: (command: AudioCommand) => Promise<any>;
  /** @todo engine 타입 추가 필요 */
  engine: any;
  tracks: {
    id: string;
    index: number;
    regions: { id: string; startTime: number; endTime: number }[];
  }[];
  userInput: string;
}

/**
 * AI 응답을 처리하고 명령어를 실행하는 함수
 * @param deps 의존성 객체
 * @returns 처리 결과 (메시지 및 상태)
 */
export async function handleAIResponse(deps: AIResponseHandlerDependencies) {
  const { engine, tracks, userInput, execute } = deps;

  const { fullResponse, error: llmResponseError } = await queryToLLM({
    engine,
    tracks,
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
    // 🔧 Execute all commands sequentially
    // The previous logic reordered commands and removed duplicates, which caused issues with
    // sequential operations (e.g., multiple exports with different ranges).
    // Now we respect the order provided by the AI.
    for (const command of commands) {
      await execute(command);
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
