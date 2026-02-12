import { useMemo } from 'react';
import { useController, useSession } from '@/layers/apps/web/context/LayerContext';
import { createCliCommands } from './factory';

export const useCliApp = () => {
  const controller = useController();
  const isPlaying = useSession(state => state.isPlaying);
  const tracks = useSession(state => state.tracks);
  const currentTime = useSession(state => state.currentTime);
  const tempo = useSession(state => state.tempo);
  
  const commands = useMemo(
    () => createCliCommands(controller, { isPlaying, tracks, currentTime, tempo }),
    [controller, isPlaying, tracks, currentTime, tempo]
  );
  
  return { isPlaying, trackCount: tracks.size, currentTime, tempo, commands };
};
