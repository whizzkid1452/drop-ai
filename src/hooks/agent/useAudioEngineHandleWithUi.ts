import { AudioEngine } from '@/logics/audio/audioEngine';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useTrackStore } from '@/stores/useTrackStore';
import {
  AudioCommandType,
  type AudioCommand,
} from '@/types/audioCommand.schema';
import { useShallow } from 'zustand/react/shallow';
import { downloadBlob } from '@/components/Daw/components/ExportButton/utils/audioExport';

export function useAudioEngineHandleWithUi() {
  const { setIsPlaying, setCurrentTime, setExportRange, exportStartTime, exportEndTime } = usePlaybackStore(
    useShallow(state => ({
      setIsPlaying: state.setIsPlaying,
      setCurrentTime: state.setCurrentTime,
      setExportRange: state.setExportRange,
      exportStartTime: state.exportStartTime,
      exportEndTime: state.exportEndTime,
    }))
  );
  const updateTrack = useTrackStore(useShallow(state => state.updateTrack));

  const handleAudioCommand = (command: AudioCommand) =>
    AudioEngine.getInstance().execute({
      command,
      callback: ({ command, result }) => {
        // Update Store based on command type
        switch (command.type) {
          case AudioCommandType.PLAY:
            setIsPlaying(true);
            break;
          case AudioCommandType.PAUSE:
            setIsPlaying(false);
            break;
          case AudioCommandType.STOP:
            setIsPlaying(false);
            setCurrentTime(0);
            break;
          case AudioCommandType.SET_TRACK_VOLUME:
            updateTrack({
              trackId: command.trackId,
              updater: t => ({ ...t, volume: command.volume }),
            });
            break;
          case AudioCommandType.SET_TRACK_PAN:
            updateTrack({
              trackId: command.trackId,
              updater: t => ({ ...t, pan: command.pan }),
            });
            break;
          case AudioCommandType.GET_TRACK_INFO:
            break;
          case AudioCommandType.SET_CURRENT_TIME:
            setCurrentTime(command.time);
            break;
          case AudioCommandType.SET_EXPORT_RANGE:
            setExportRange(command.startTime, command.endTime);
            break;
          case AudioCommandType.CLEAR_EXPORT_RANGE:
            setExportRange(null, null);
            break;
          case AudioCommandType.EXPORT_AUDIO:
            if (result instanceof Blob) {
              // Generate filename based on current Store range
              let filename = 'export';
              if (exportStartTime !== null && exportEndTime !== null) {
                filename = `export_${exportStartTime}-${exportEndTime}s`;
              }
              downloadBlob(result, `${filename}.wav`);
            }
            break;
        }
      },
    });

  return { handleAudioCommand };
}
