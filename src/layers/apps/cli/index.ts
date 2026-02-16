import { useMemo } from 'react';
import {
  useController,
  useSession,
} from '../../presentation/context/LayerContext';
import { AppController } from '../../controllers/app-controller';
import { CommandsType } from './constants';

export interface CliCommand {
  description: string;
  usage: string;
  fn: (...args: any[]) => string | Promise<string>;
}

export type CliCommands = Record<CommandsType, CliCommand>;

export const createCliCommands = (
  controller: AppController,
  state: { isPlaying: boolean; trackCount: number }
): CliCommands => {
  const commands: CliCommands = {
    [CommandsType.play]: {
      description: 'Start audio playback',
      usage: 'play',
      fn: async () => {
        await controller.playback.handlePlay();
        return 'Playback started...';
      },
    },
    [CommandsType.stop]: {
      description: 'Stop audio playback',
      usage: 'stop',
      fn: () => {
        controller.playback.handleStop();
        return 'Playback stopped.';
      },
    },
    [CommandsType.track]: {
      description: 'Track management (add/remove)',
      usage: 'track add <id> | track remove <id>',
      fn: async (sub: string, id: string) => {
        if (sub === 'add') {
          if (!id) return 'Error: Track ID required.';
          await controller.track.addTrack('mock-url', id);
          return 'Track ' + id + ' added.';
        } else if (sub === 'remove') {
          if (!id) return 'Error: Track ID required.';
          controller.track.removeTrack(id);
          return 'Track ' + id + ' removed.';
        }
        return 'Usage: track add <id> OR track remove <id>';
      },
    },
    [CommandsType.status]: {
      description: 'Display current session status',
      usage: 'status',
      fn: () => {
        const statusText = state.isPlaying ? 'Playing' : 'Stopped';
        return 'Status: ' + statusText + '\nTracks: ' + state.trackCount;
      },
    },
    [CommandsType.help]: {
      description: 'Show available commands',
      usage: 'help',
      fn: () => {
        const list = Object.entries(commands)
          .map(
            ([name, cmd]) =>
              `  ${name.padEnd(12)} - ${cmd.description} (Usage: ${cmd.usage})`
          )
          .join('\n');
        return 'Available commands:\n' + list;
      },
    },
  };
  return commands;
};

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
