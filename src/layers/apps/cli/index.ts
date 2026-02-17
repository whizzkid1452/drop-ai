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

import { getVisualWidth, padRight } from '@/utils/visual-width';

export const createCliCommands = ({
  controller,
}: {
  controller: AppController;
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
    [CommandsType.pause]: {
      description: 'Pause audio playback',
      usage: 'pause',
      fn: () => {
        controller.playback.handlePause();
        return 'Playback paused.';
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
        const { isPlaying, tracks, bpm, isLooping, loopStart, loopEnd } =
          controller.session.getState();
        const statusText = isPlaying ? 'Playing' : 'Stopped';
        const loopText = isLooping ? `ON (${loopStart}s - ${loopEnd}s)` : 'OFF';
        const currentTime = controller.playback.getCurrentTime();

        let output = `Status: ${statusText}\nTime: ${currentTime.toFixed(2)}s\nBPM: ${bpm}\nLoop: ${loopText}\nTracks: ${tracks.size}\n\n`;

        if (tracks.size > 0) {
          // Table Header
          output +=
            padRight('ID', 38) +
            padRight('Name', 20) +
            padRight('Vol', 6) +
            padRight('Pan', 6) +
            padRight('Mute', 6) +
            padRight('Solo', 6) +
            '\n';
          output += '-'.repeat(76) + '\n';

          // Table Body
          tracks.forEach(track => {
            const volStr = track.volume.toFixed(1);
            const muteStr = track.isMuted ? 'On' : 'Off';
            const soloStr = track.isSoloed ? 'On' : 'Off';
            const nameStr = (track.name || 'Untitled').normalize('NFC');
            // Truncate name logic (simplified for now or reused)
            let truncatedName = nameStr;
            let currentWidth = 0;
            let charIndex = 0;
            for (const char of nameStr) {
              const w = getVisualWidth(char);
              if (currentWidth + w > 18) break;
              currentWidth += w;
              charIndex++;
            }
            if (charIndex < nameStr.length) {
              truncatedName = nameStr.slice(0, charIndex) + '..';
            }

            output +=
              padRight(track.id, 38) +
              padRight(truncatedName, 20) +
              padRight(volStr, 6) +
              padRight(track.pan.toFixed(1), 6) +
              padRight(muteStr, 6) +
              padRight(soloStr, 6) +
              '\n';

            // List regions
            if (track.regions.length > 0) {
              output += '  Regions:\n';
              track.regions.forEach(region => {
                output += `    - [${region.id}] Start: ${region.startTime.toFixed(1)}s, Dur: ${region.duration.toFixed(1)}s\n`;
              });
            }
          });
        }

        return output.trim();
      },
    },
    [CommandsType.upload]: {
      description: 'Upload an audio file as a region',
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
              try {
                let targetTrackId = trackId;

                // If no trackId provided, create a new track first
                if (!targetTrackId) {
                  const { id } = await controller.track.addTrack();
                  targetTrackId = id;
                }

                // Add region to the track
                const { regionId } = await controller.track.addRegion(
                  targetTrackId,
                  file,
                  0
                ); // Default start at 0

                resolve(
                  `Added region ${regionId} to track ${targetTrackId} from ${file.name}`
                );
              } catch (error) {
                console.error(error);
                resolve('Error uploading file: ' + (error as Error).message);
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
    [CommandsType.pan]: {
      description: 'Set track panning (-1.0 to 1.0)',
      usage: 'pan <trackId> <value>',
      fn: (trackId: string, value: string) => {
        if (!trackId || !value)
          return 'Error: Track ID and pan value required.';
        const pan = parseFloat(value);
        if (isNaN(pan) || pan < -1 || pan > 1) {
          return 'Error: Pan must be a number between -1.0 (Left) and 1.0 (Right)';
        }
        controller.track.setTrackPan(trackId, pan);
        return 'Set pan of track ' + trackId + ' to ' + pan;
      },
    },
    [CommandsType.region]: {
      description: 'Region management (move/remove)',
      usage:
        'region move <trackId> <regionId> <startTime> | region remove <trackId> <regionId>',
      fn: (sub: string, trackId: string, regionId: string, value?: string) => {
        if (!sub) {
          return 'Error: Unknown command. Usage: region move <trackId> <regionId> <value> | region remove <trackId> <regionId> | region split ... | region resize ...';
        }

        if (!trackId || !regionId) {
          return 'Error: Track ID and Region ID are required.';
        }

        switch (sub) {
          case 'move': {
            if (!value) return 'Error: Start time required for move.';
            const startTime = parseFloat(value);
            if (isNaN(startTime) || startTime < 0) {
              return 'Error: Start time must be a valid positive number.';
            }
            controller.track.moveRegion(trackId, regionId, startTime);
            return `Moved region ${regionId} to ${startTime}s.`;
          }
          case 'remove': {
            controller.track.removeRegion(trackId, regionId);
            return `Removed region ${regionId}.`;
          }
          case 'split': {
            if (!value) return 'Error: Split time required.';
            const splitTime = parseFloat(value);
            if (isNaN(splitTime) || splitTime < 0) {
              return 'Error: Split time must be a valid positive number.';
            }
            try {
              const { leftId, rightId } = controller.track.splitRegion(
                trackId,
                regionId,
                splitTime
              );
              return `Split region ${regionId} into ${leftId} and ${rightId} at ${splitTime}s.`;
            } catch (e) {
              return `Error: ${(e as Error).message}`;
            }
          }
          case 'resize': {
            if (!value) return 'Error: Duration required.';
            const duration = parseFloat(value);
            if (isNaN(duration) || duration <= 0) {
              return 'Error: Duration must be a valid positive number.';
            }
            try {
              controller.track.resizeRegion(trackId, regionId, duration);
              return `Resized region ${regionId} to ${duration}s.`;
            } catch (e) {
              return `Error: ${(e as Error).message}`;
            }
          }
          default:
            return 'Error: Unknown subcommand. Use "move", "remove", "split", or "resize".';
        }
      },
    },
    [CommandsType.seek]: {
      description: 'Seek to a specific time',
      usage: 'seek <time>',
      fn: (timeStr: string) => {
        if (!timeStr) return 'Error: Time (seconds) required.';
        const time = parseFloat(timeStr);
        if (isNaN(time) || time < 0) {
          return 'Error: Time must be a valid positive number.';
        }
        controller.playback.handleSeek(time);
        return `Seek to ${time}s`;
      },
    },
    [CommandsType.loop]: {
      description: 'Set loop range or turn off loop',
      usage: 'loop <start> <end> | loop off',
      fn: (arg1: string, arg2?: string) => {
        if (arg1 === 'off') {
          controller.playback.handleLoop(0, 0, false);
          return 'Loop turned off.';
        }
        if (!arg1 || !arg2) {
          return 'Error: Usage: loop <start> <end> or loop off';
        }
        const start = parseFloat(arg1);
        const end = parseFloat(arg2);
        if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
          return 'Error: Invalid loop points. Ensure start < end and both are positive numbers.';
        }
        controller.playback.handleLoop(start, end, true);
        return `Loop set from ${start}s to ${end}s.`;
      },
    },
    [CommandsType.bpm]: {
      description: 'Set BPM',
      usage: 'bpm <value>',
      fn: (value: string) => {
        if (!value) return 'Error: BPM value required.';
        const bpm = parseFloat(value);
        if (isNaN(bpm) || bpm <= 0) {
          return 'Error: BPM must be a valid positive number.';
        }
        controller.playback.handleBpm(bpm);
        return `BPM set to ${bpm}`;
      },
    },
    [CommandsType.master]: {
      description: 'Set Master Volume (0.0 - 1.0)',
      usage: 'master <value>',
      fn: (value: string) => {
        if (!value) return 'Error: Volume value required.';
        const vol = parseFloat(value);
        if (isNaN(vol) || vol < 0 || vol > 1) {
          return 'Error: Volume must be a number between 0.0 and 1.0';
        }
        controller.playback.handleMasterVolume(vol);
        return `Master volume set to ${vol}`;
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
    [CommandsType.debug]: {
      description: 'Show Audio Engine Debug Info',
      usage: 'debug',
      fn: () => {
        return controller.getDebugInfo?.() || 'No debug info available';
      },
    },
    [CommandsType.export]: {
      description: 'Export session to WAV file',
      usage: 'export [filename]',
      fn: async (filename?: string) => {
        if (typeof document === 'undefined') {
          return 'Error: Export only supported in browser environment';
        }

        const name = filename || 'export.wav';
        try {
          // Get current session duration.
          // For now, let's look at the end of the last region in the session.
          // Or use a default duration if empty.
          const { tracks } = controller.session.getState();
          let maxTime = 0;
          tracks.forEach(track => {
            track.regions.forEach(region => {
              const end = region.startTime + region.duration;
              if (end > maxTime) maxTime = end;
            });
          });

          if (maxTime === 0) {
            return 'Error: Session is empty (no regions). Nothing to export.';
          }

          // Add a small buffer to the end (e.g., 1s reverb tail or just safety)
          const duration = maxTime + 1.0;

          // Perform Export
          // We need to access AudioEngine directly or via Controller.
          // Ideally Controller should expose this.
          // But for now, let's access via window.audioEngine if possible, or assume controller has it.
          // The AppController doesn't expose 'exportSession' yet.
          // We should add it to AppController or SessionController.
          // Let's add 'exportSession' to SessionController?
          // Or just cast for now to make progress, but better to do it right.

          await controller.exportSession(duration, name);

          return `Exported session to ${name} (${duration.toFixed(1)}s)`;
        } catch (e) {
          console.error(e);
          return `Error exporting session: ${(e as Error).message}`;
        }
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
      }),
    [controller]
  );
  return { isPlaying, trackCount, commands };
};
