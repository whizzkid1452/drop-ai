import { useCallback } from 'react';
import { AudioService } from '@/core/audio/AudioService';
import { AudioCommandType } from '@/types/audioCommand.schema';
import type { AudioCommand } from '@/types/audioCommand.schema';
import type { ExecuteResult } from './audioEngine.types';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useProjectExport } from '@/logics/audio/useProjectExport';

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
  const setExportRange = usePlaybackStore(state => state.setExportRange);
  const { exportProject } = useProjectExport();

  /**
   * 오디오 명령 실행
   * 
   * @param command - 실행할 오디오 명령
   * @returns 명령 실행 결과
   */
  const execute = useCallback(
    async <T extends AudioCommand>(command: T): Promise<ExecuteResult<T>> => {
      const service = AudioService.getInstance();

      switch (command.type) {
        case AudioCommandType.PLAY:
          await service.play();
          return undefined as any;
        case AudioCommandType.PAUSE:
          service.pause();
          return undefined as any;
        case AudioCommandType.STOP:
          service.stop();
          return undefined as any;
        case AudioCommandType.SET_CURRENT_TIME:
          service.setTime(command.time);
          return undefined as any;
        case AudioCommandType.SET_TRACK_VOLUME:
          service.setTrackVolume(command.trackId, command.volume);
          return undefined as any;
        case AudioCommandType.SET_TRACK_PAN:
          service.setTrackPan(command.trackId, command.pan);
          return undefined as any;
        case AudioCommandType.LOAD_REGION:
          await service.addRegion(command.trackId, {
            id: command.regionId,
            url: command.url,
            startTime: command.startTime,
            sourceStartTime: command.startOffset ?? 0,
            duration: command.duration,
            // AudioFile not provided in command, service handles undefined
          });
          return undefined as any;
        case AudioCommandType.SET_EXPORT_RANGE:
          // 🔧 Promise를 반환하여 다음 명령(EXPORT_AUDIO)이 확실히 대기하도록 보장
          await Promise.resolve(setExportRange(command.startTime, command.endTime));
          return undefined as any;
        case AudioCommandType.CLEAR_EXPORT_RANGE:
          await Promise.resolve(setExportRange(null, null));
          return undefined as any;
        case AudioCommandType.EXPORT_AUDIO:
          // Note: exportProject uses range from store if not provided
          await exportProject({ filename: command.filename });
          return undefined as any;
        default:
          console.warn('Unknown or unimplemented command:', command.type);
          return undefined as any;
      }
    },
    [setExportRange, exportProject]
  );

  return { execute };
}
