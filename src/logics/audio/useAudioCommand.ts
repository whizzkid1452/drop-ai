import { useCallback } from 'react';
import { AudioService } from '@/core/audio/AudioService';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useTrackStore } from '@/stores/useTrackStore';
import { useProjectExport } from '@/logics/audio/useProjectExport';

/**
 * Audio Command Executor Hook
 * 
 * - Bridges the gap between AI commands (AudioCommand) and the core AudioService.
 * - Manages UI updates (Stores) alongside AudioService actions.
 */
export function useAudioCommand() {
  const setExportRange = usePlaybackStore(state => state.setExportRange);
  const setIsPlaying = usePlaybackStore(state => state.setIsPlaying);
  const setCurrentTime = usePlaybackStore(state => state.setCurrentTime);
  const updateTrack = useTrackStore(state => state.updateTrack);

  const { exportProject } = useProjectExport();

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
            setIsPlaying(true);
            break;

          case AudioCommandType.PAUSE:
            service.pause();
            setIsPlaying(false);
            break;

          case AudioCommandType.STOP:
            service.stop();
            setIsPlaying(false);
            break;

          case AudioCommandType.SET_CURRENT_TIME:
            service.setTime(command.time);
            setCurrentTime(command.time);
            break;

          case AudioCommandType.SET_TRACK_VOLUME:
            service.setTrackVolume(command.trackId, command.volume);
            updateTrack({
              trackId: command.trackId,
              updater: track => ({ ...track, volume: command.volume }),
            });
            break;

          case AudioCommandType.SET_TRACK_PAN:
            service.setTrackPan(command.trackId, command.pan);
            updateTrack({
              trackId: command.trackId,
              updater: track => ({ ...track, pan: command.pan }),
            });
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
            // Correctly calling AudioService method
            service.removeRegion(command.trackId, command.regionId);

            // Update Frontend Store
            updateTrack({
              trackId: command.trackId,
              updater: track => ({
                ...track,
                regions: track.regions.filter(r => r.id !== command.regionId),
              }),
            });
            break;

          case AudioCommandType.SET_EXPORT_RANGE:
            // Handled via Store only (AudioService doesn't manage export range state intentionally)
            setExportRange(command.startTime, command.endTime);
            break;

          case AudioCommandType.CLEAR_EXPORT_RANGE:
            setExportRange(null, null);
            break;

          case AudioCommandType.EXPORT_AUDIO:
            // Note: exportProject uses range from store if not provided
            await exportProject({ filename: command.filename });
            break;

          default:
            console.warn('[useAudioCommand] Unknown command:', command);
        }
      } catch (error) {
        console.error('[useAudioCommand] Execution failed:', error);
        throw error;
      }
    },
    [setExportRange, exportProject, setIsPlaying, setCurrentTime, updateTrack]
  );

  return { execute };
}
