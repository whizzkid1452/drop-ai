import { useCallback } from 'react';
import { AudioService } from '@/core/audio/AudioService';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { downloadBlob } from '@/components/Daw/components/ExportButton/utils/audioExport';

/**
 * Audio Command Executor Hook
 * 
 * - Bridges the gap between AI commands (AudioCommand) and the core AudioService.
 * - Manages UI updates (Stores) alongside AudioService actions.
 */
export function useAudioCommand() {

  /**
   * Execute an AudioCommand
   * 
   * @param command - The command to execute
   */
  const execute = useCallback(
    async (command: AudioCommand): Promise<void> => {
      const service = AudioService.getInstance();

      try {
        switch (command.type) {
          case AudioCommandType.PLAY:
            await service.play();
            break;

          case AudioCommandType.PAUSE:
            service.pause();
            break;

          case AudioCommandType.STOP:
            service.stop();
            break;

          case AudioCommandType.SET_CURRENT_TIME:
            service.setTime(command.time);
            break;

          case AudioCommandType.SET_TRACK_VOLUME:
            service.setTrackVolume(command.trackId, command.volume);
            break;

          case AudioCommandType.SET_TRACK_PAN:
            service.setTrackPan(command.trackId, command.pan);
            break;

          case AudioCommandType.LOAD_REGION:
            await service.addRegion(command.trackId, {
              id: command.regionId,
              url: command.url,
              startTime: command.startTime,
              sourceStartTime: command.startOffset ?? 0,
              duration: command.duration,
            });
            break;

          case AudioCommandType.UNLOAD_REGION:
            service.removeRegion(command.trackId, command.regionId);
            break;

          case AudioCommandType.SET_EXPORT_RANGE:
            service.setExportRange(command.startTime, command.endTime);
            break;

          case AudioCommandType.CLEAR_EXPORT_RANGE:
            service.setExportRange(null, null);
            break;

          case AudioCommandType.EXPORT_AUDIO:
            {
              // Call AudioService directly
              const blob = await service.exportProject();
              
              if (blob instanceof Blob) {
                const filename = command.filename || 'export';
                downloadBlob(blob, `${filename}.wav`);
              }
            }
            break;

          default:
            console.warn('[useAudioCommand] Unknown command:', command);
        }
      } catch (error) {
        console.error('[useAudioCommand] Execution failed:', error);
        throw error;
      }
    },
    []
  );

  return { execute };
}
