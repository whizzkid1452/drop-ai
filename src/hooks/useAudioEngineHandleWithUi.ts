import { AudioEngine } from '@/logics/audio/audioEngine';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useTrackStore } from '@/stores/useTrackStore';
import { AudioCommandType, type AudioCommand } from '@/types/audioEngine';
import { useShallow } from 'zustand/react/shallow';

export function useAudioEngineHandleWithUi() {
  const { setIsPlaying, setCurrentTime } = usePlaybackStore();
  const updateTrack = useTrackStore(useShallow(state => state.updateTrack));

  const handleAudioCommand = (command: AudioCommand) =>
    AudioEngine.getInstance().execute({
      command,
      callback: ({ command }) => {
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
        }
      },
    });

  return { handleAudioCommand };
}
