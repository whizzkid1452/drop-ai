import { useMemo } from 'react';
import {
  useController,
  useSession,
} from '../../presentation/context/LayerContext';
import { AppController } from '../../controllers/app-controller';

export interface CliCommand {
  description: string;
  usage: string;
  fn: (...args: any[]) => string | Promise<string>;
}

export type CliCommands = Record<string, CliCommand>;

export const createCliCommands = (
  controller: AppController,
  state: { isPlaying: boolean; trackCount: number }
): CliCommands => ({
  play: {
    description: 'Play Audio',
    usage: 'play',
    fn: async () => {
      await controller.playback.handlePlay();
      return 'Playback started...';
    },
  },
  stop: {
    description: 'Stop Audio',
    usage: 'stop',
    fn: () => {
      controller.playback.handleStop();
      return 'Playback stopped.';
    },
  },
  'add-track': {
    description: 'Add a mock track',
    usage: 'add-track <id>',
    fn: async (id: string) => {
      if (!id) return 'Error: Track ID required.';
      await controller.track.addTrack('mock-url', id);
      return 'Track ' + id + ' added.';
    },
  },
  status: {
    description: 'Check status',
    usage: 'status',
    fn: () => {
      const statusText = state.isPlaying ? 'Playing' : 'Stopped';
      return 'Status: ' + statusText + '\nTracks: ' + state.trackCount;
    },
  },
});

export const useCliApp = () => {
  const controller = useController();
  const isPlaying = useSession(state => state.isPlaying);
  const trackCount = useSession(state => state.tracks.size);
  const commands = useMemo(
    () => createCliCommands(controller, { isPlaying, trackCount }),
    [controller, isPlaying, trackCount]
  );
  return { isPlaying, trackCount, commands };
};
