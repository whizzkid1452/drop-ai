import { useCallback } from 'react';
import { AudioEngine } from './audioEngine';
import type { AudioCommand } from '@/types/audioCommand.schema';
import type { ExecuteResult } from './audioEngine.types';

/**
 * AudioEngine 명령을 실행하는 React Hook
 * 
 * 역할:
 * - AudioEngine 인스턴스에 접근하여 명령 실행
 * - UI 행위(다운로드, alert 등)를 포함하지 않는 순수 래퍼
 * 
 * @returns { execute } - 명령 실행 함수
 */
export function useAudioCommand() {
  /**
   * 오디오 명령 실행
   * 
   * @param command - 실행할 오디오 명령
   * @returns 명령 실행 결과
   */
  const execute = useCallback(
    async <T extends AudioCommand>(command: T): Promise<ExecuteResult<T>> => {
      const audioEngine = AudioEngine.getInstance();
      return await audioEngine.execute(command);
    },
    []
  );

  return { execute };
}
