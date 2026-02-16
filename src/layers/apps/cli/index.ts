import { useMemo } from 'react';
import { useController, useSession } from '../context/LayerContext';
import { CommandsType } from './constants';
import type { AppController } from '@/layers/controllers';

export interface CliCommand {
  description: string;
  usage: string;
  fn: (...args: any[]) => string | Promise<string>;
}

export type CliCommands = Record<CommandsType, CliCommand>;

export const createCliCommands = ({
  controller,
  initialState,
}: {
  controller: AppController;
  initialState: { isPlaying: boolean; trackCount: number };
}): CliCommands => {
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
      fn: async (sub: string, id?: string) => {
        if (sub === 'add') {
          const { id: newId } = await controller.track.addTrack();
          return 'Track ' + newId + ' added.';
        } else if (sub === 'remove') {
          if (!id) return 'Error: Track ID required.';
          controller.track.removeTrack(id);
          return 'Track ' + id + ' removed.';
        }
        return 'Usage: track add | track remove <id>';
      },
    },
    [CommandsType.status]: {
      description: 'Display current session status',
      usage: 'status',
      fn: () => {
        const statusText = initialState.isPlaying ? 'Playing' : 'Stopped';
        return 'Status: ' + statusText + '\nTracks: ' + initialState.trackCount;
      },
    },
    [CommandsType.upload]: {
      description: 'Upload an audio file to a new or existing track',
      usage: 'upload [trackId]',
      fn: (trackId?: string) => {
        return new Promise<string>(resolve => {
          if (typeof document === 'undefined') {
            resolve('Error: File upload only supported in browser environment');
            return;
          }

          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'audio/*';
          input.style.display = 'none';

          input.onchange = async e => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
              const file = files[0];
              if (trackId) {
                await controller.track.updateTrackSourceFromFile(trackId, file);
                resolve('Updated track ' + trackId + ' with ' + file.name);
              } else {
                const { id } = await controller.track.createTrackFromFile(file);
                resolve('Created new track ' + id + ' from ' + file.name);
              }
            } else {
              resolve('Upload cancelled');
            }
            document.body.removeChild(input);
          };

          document.body.appendChild(input);
          input.click();
        });
      },
    },
    [CommandsType.volume]: {
      description: 'Set track volume (0.0 to 1.0)',
      usage: 'volume <trackId> <value>',
      fn: (trackId: string, value: string) => {
        if (!trackId || !value)
          return 'Error: Track ID and volume value required.';
        const vol = parseFloat(value);
        if (isNaN(vol) || vol < 0 || vol > 1) {
          return 'Error: Volume must be a number between 0.0 and 1.0';
        }
        controller.track.setTrackVolume(trackId, vol);
        return 'Set volume of track ' + trackId + ' to ' + vol;
      },
    },
    [CommandsType.mute]: {
      description: 'Mute/Unmute a track',
      usage: 'mute <trackId> <on|off>',
      fn: (trackId: string, state: string) => {
        if (!trackId || !state)
          return 'Error: Track ID and state (on/off) required.';
        if (state !== 'on' && state !== 'off')
          return 'Error: State must be "on" or "off".';
        const isMuted = state === 'on';
        controller.track.setTrackMute(trackId, isMuted);
        return 'Track ' + trackId + (isMuted ? ' muted.' : ' unmuted.');
      },
    },
    [CommandsType.solo]: {
      description: 'Solo/Unsolo a track',
      usage: 'solo <trackId> <on|off>',
      fn: (trackId: string, state: string) => {
        if (!trackId || !state)
          return 'Error: Track ID and state (on/off) required.';
        if (state !== 'on' && state !== 'off')
          return 'Error: State must be "on" or "off".';
        const isSoloed = state === 'on';
        controller.track.setTrackSolo(trackId, isSoloed);
        return 'Track ' + trackId + (isSoloed ? ' soloed.' : ' unsoloed.');
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
    () =>
      createCliCommands({
        controller,
        initialState: { isPlaying, trackCount },
      }),
    [controller, isPlaying, trackCount]
  );
  return { isPlaying, trackCount, commands };
};
