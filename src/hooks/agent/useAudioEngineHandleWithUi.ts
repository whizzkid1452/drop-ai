import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AudioEngine } from '@/logics/audio/audioEngine';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import {
  AudioCommandType,
  type AudioCommand,
} from '@/types/audioCommand.schema';
import { downloadBlob } from '@/components/Daw/components/ExportButton/utils/audioExport';
import { AudioEngineError, getUserFriendlyMessage } from '@/logics/audio/audioEngine.errors';

/**
 * AudioEngine을 UI와 연결하는 Hook
 * 
 * 역할:
 * - AudioEngine 명령 실행
 * - 에러 처리 및 사용자 알림
 * - Export 파일 다운로드 처리
 */
export function useAudioEngineHandleWithUi() {
  const { exportStartTime, exportEndTime } = usePlaybackStore(
    useShallow(state => ({
      exportStartTime: state.exportStartTime,
      exportEndTime: state.exportEndTime,
    }))
  );

  /**
   * 오디오 명령 처리
   * 
   * @param command - 실행할 오디오 명령
   */
  const handleAudioCommand = useCallback(
    async (command: AudioCommand) => {
      try {
        // 실행 시점에 getInstance 호출 (lazy)
        const audioEngine = AudioEngine.getInstance();
        const result = await audioEngine.execute(command);

        // Export 명령의 경우 파일 다운로드 처리
        if (command.type === AudioCommandType.EXPORT_AUDIO && result instanceof Blob) {
          let filename = 'export';
          if (exportStartTime !== null && exportEndTime !== null) {
            filename = `export_${exportStartTime}-${exportEndTime}s`;
          }
          downloadBlob(result, `${filename}.wav`);
        }

        return result;
      } catch (error) {
        // AudioEngineError는 사용자 친화적 메시지 표시
        if (error instanceof AudioEngineError) {
          const friendlyMessage = getUserFriendlyMessage(error);
          alert(friendlyMessage);
          console.error('[AudioEngine Error]', {
            code: error.code,
            message: error.message,
            details: error.details,
          });
        } else {
          // 기타 에러
          alert('알 수 없는 오류가 발생했습니다.');
          console.error('[Unknown Error]', error);
        }
        
        throw error;
      }
    },
    [exportStartTime, exportEndTime]
  );

  return { handleAudioCommand };
}
