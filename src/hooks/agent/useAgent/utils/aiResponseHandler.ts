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
    // Execute all commands sequentially
    for (const command of commands) {
      if (command.type === AudioCommandType.EXPORT_AUDIO) {
        // Export는 전용 Hook 함수를 사용하여 로직 통일 (파일명 생성 등)
        const filename = (command as any).filename || 'agent-export';
        await exportProject({ filename });
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
