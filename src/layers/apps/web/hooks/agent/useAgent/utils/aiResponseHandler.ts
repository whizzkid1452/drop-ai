import {
  parseAudioCommandString,
  AudioCommandType,
  type AudioCommand,
} from '@/types/audioCommand.schema';
import { queryToLLM as queryToLLM } from './queryToLLM';
import type { MLCEngine } from '@/types/webllm.types';
import { trackAudioCommandExecuted } from '@/utils/analytics';

export interface AIResponseHandlerDependencies {
  execute: (command: AudioCommand) => Promise<any>;
  engine: MLCEngine;
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

  if (!fullResponse) {
    return {
      message: 'No response from AI',
      status: 'error' as const,
    };
  }

  let { commands, error } = parseAudioCommandString({
    commandString: fullResponse,
  });

  // SET_EXPORT_RANGE만 있으면 실제 내보내기가 안 됨. EXPORT_AUDIO 자동 추가
  if (
    commands &&
    commands.length === 1 &&
    commands[0].type === AudioCommandType.SET_EXPORT_RANGE
  ) {
    commands = [...commands, { type: AudioCommandType.EXPORT_AUDIO }];
  }

  const executionResults: Array<{
    commandType: string;
    success: boolean;
    errorMessage?: string;
  }> = [];

  if (commands && commands.length > 0) {
    // 🔧 Execute all commands sequentially
    // The previous logic reordered commands and removed duplicates, which caused issues with
    // sequential operations (e.g., multiple exports with different ranges).
    // Now we respect the order provided by the AI.
    for (const command of commands) {
      try {
        await execute(command);
        // Google Analytics: 명령어 실행 성공 추적
        trackAudioCommandExecuted(command.type, true);
        executionResults.push({
          commandType: command.type,
          success: true,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Google Analytics: 명령어 실행 실패 추적
        trackAudioCommandExecuted(command.type, false, errorMessage);
        executionResults.push({
          commandType: command.type,
          success: false,
          errorMessage,
        });
        console.error('[aiResponseHandler] Command execution failed:', error);
      }
    }

    return {
      message: fullResponse || '✅ Commands executed',
      status: 'idle' as const,
      parsedCommands: commands,
      executionResults,
    };
  }

  return {
    message: fullResponse || 'no response',
    status: error ? 'error' : 'idle',
    parsedCommands: null,
    executionResults: [],
  } as const;
}
