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
    // 🔧 EXPORT_AUDIO는 항상 마지막에 실행되도록 분리
    const hasExportCommand = commands.some(
      cmd => cmd.type === AudioCommandType.EXPORT_AUDIO
    );
    const otherCommands = commands.filter(
      cmd => cmd.type !== AudioCommandType.EXPORT_AUDIO
    );

    // 🔧 중복 명령 제거: 같은 타입의 명령은 마지막 것만 사용
    const uniqueOtherCommands = otherCommands.reduce((acc, command) => {
      const existingIndex = acc.findIndex(c => {
        // 타입이 같고, 파라미터가 있는 명령어의 경우 파라미터까지 비교
        if (c.type !== command.type) return false;

        // 파라미터가 없는 명령어는 타입만 같으면 중복으로 간주
        if (command.type === AudioCommandType.PLAY ||
          command.type === AudioCommandType.PAUSE ||
          command.type === AudioCommandType.STOP ||
          command.type === AudioCommandType.GET_TRACK_INFO) {
          return true;
        }

        // 파라미터가 있는 명령어는 전체 비교 (나중 명령으로 덮어쓰기)
        return JSON.stringify(c) === JSON.stringify(command);
      });

      if (existingIndex !== -1) {
        // 기존 명령을 새 명령으로 교체 (마지막 명령이 우선)
        acc[existingIndex] = command;
      } else {
        acc.push(command);
      }

      return acc;
    }, [] as AudioCommand[]);

    // 1. 먼저 EXPORT_AUDIO가 아닌 모든 명령어 실행 (순차적으로)
    for (const command of uniqueOtherCommands) {
      if (command.type === AudioCommandType.GET_TRACK_INFO) {
        // 엔진을 거치지 않고 핸들러 레벨에서 정보 처리 (필요시 추가 로직 구현)
        console.log('[aiResponseHandler] GET_TRACK_INFO requested');
      } else {
        await execute(command);
      }
    }

    // 2. 그 다음 EXPORT_AUDIO 명령어 실행 (있으면 한 번만)
    if (hasExportCommand) {
      await execute({ type: AudioCommandType.EXPORT_AUDIO });
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
