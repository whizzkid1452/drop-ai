import {
  parseAudioCommandString,
  type AudioCommand,
  AudioCommandType,
} from '@/types/audioCommand.schema';
import { queryToLLM as queryToLLM } from './queryToLLM';
import type { UseProjectExportOptions } from '@/logics/audio/useProjectExport';

export interface AIResponseHandlerDependencies {
  execute: (command: AudioCommand) => Promise<any>;
  exportProject: (options?: UseProjectExportOptions) => Promise<void>;
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
  const { engine, trackCount, userInput, execute, exportProject } = deps;

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
    let pendingExportRange: { startTime: number; endTime: number } | undefined;

    // Execute all commands sequentially
    for (const command of commands) {
      if (command.type === AudioCommandType.SET_EXPORT_RANGE) {
        // Range 설정 명령인 경우 임시 변수에 저장 (동기화 문제 해결)
        pendingExportRange = { startTime: command.startTime, endTime: command.endTime };
        await execute(command);
      } else if (command.type === AudioCommandType.CLEAR_EXPORT_RANGE) {
        pendingExportRange = undefined;
        await execute(command);
      } else if (command.type === AudioCommandType.EXPORT_AUDIO) {
        // Export 시 pendingRange가 있으면 우선 사용
        const filename = (command as any).filename || 'agent-export';
        // pendingExportRange가 undefined여도 undefined로 전달되어 스토어 값 사용
        await exportProject({ filename, range: pendingExportRange });
      } else if (command.type === AudioCommandType.GET_TRACK_INFO) {
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
