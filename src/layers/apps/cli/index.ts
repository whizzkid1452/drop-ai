import { useMemo } from 'react';
import { useController, useSession } from '../web/context/LayerContext';
import { AppController } from '../../controllers/app-controller';

export interface CliCommand {
  description: string;
  usage: string;
  fn: (...args: any[]) => string | Promise<string>;
}

export type CliCommands = Record<string, CliCommand>;

export const createCliCommands = (
  controller: AppController,
  state: { isPlaying: boolean; trackCount: number; currentTime: number; tempo: number }
): CliCommands => {
  const commands: CliCommands = {
    // ===== Transport Control =====
    play: {
      description: 'Start audio playback',
      usage: 'play',
      fn: async () => {
        await controller.playback.handlePlay();
        return 'Playback started...';
      }
    },
    stop: {
      description: 'Stop audio playback',
      usage: 'stop',
      fn: () => {
        controller.playback.handleStop();
        return 'Playback stopped.';
      }
    },
    pause: {
      description: 'Pause audio playback',
      usage: 'pause',
      fn: () => {
        controller.playback.handlePause();
        return 'Playback paused.';
      }
    },
    seek: {
      description: 'Seek to specific time',
      usage: 'seek <time>',
      fn: (time: string) => {
        if (!time) return 'Error: Time required. Usage: seek <time>';
        const timeNum = parseFloat(time);
        if (isNaN(timeNum)) return 'Error: Invalid time value.';
        controller.playback.handleSeek(timeNum);
        return `Seeked to ${timeNum}s`;
      }
    },
    tempo: {
      description: 'Set tempo (BPM)',
      usage: 'tempo <bpm>',
      fn: (bpm: string) => {
        if (!bpm) return 'Error: BPM required. Usage: tempo <bpm>';
        const bpmNum = parseFloat(bpm);
        if (isNaN(bpmNum) || bpmNum <= 0) return 'Error: Invalid BPM value.';
        controller.playback.handleSetTempo(bpmNum);
        return `Tempo set to ${bpmNum} BPM`;
      }
    },

    // ===== Track Management =====
    track: {
      description: 'Track management',
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
      }
    },
    volume: {
      description: 'Set track volume',
      usage: 'volume <trackId> <value>',
      fn: (trackId: string, value: string) => {
        if (!trackId || !value) return 'Error: Usage: volume <trackId> <value>';
        const vol = parseFloat(value);
        if (isNaN(vol) || vol < 0 || vol > 1) return 'Error: Volume must be between 0.0 and 1.0';
        controller.track.setVolume(trackId, vol);
        return `Volume for ${trackId} set to ${vol}`;
      }
    },
    pan: {
      description: 'Set track pan',
      usage: 'pan <trackId> <value>',
      fn: (trackId: string, value: string) => {
        if (!trackId || !value) return 'Error: Usage: pan <trackId> <value>';
        const panVal = parseFloat(value);
        if (isNaN(panVal) || panVal < -1 || panVal > 1) return 'Error: Pan must be between -1.0 and 1.0';
        controller.track.setPan(trackId, panVal);
        return `Pan for ${trackId} set to ${panVal}`;
      }
    },
    mute: {
      description: 'Mute a track',
      usage: 'mute <trackId>',
      fn: (trackId: string) => {
        if (!trackId) return 'Error: Track ID required.';
        controller.track.setMute(trackId, true);
        return `Track ${trackId} muted`;
      }
    },
    unmute: {
      description: 'Unmute a track',
      usage: 'unmute <trackId>',
      fn: (trackId: string) => {
        if (!trackId) return 'Error: Track ID required.';
        controller.track.setMute(trackId, false);
        return `Track ${trackId} unmuted`;
      }
    },
    solo: {
      description: 'Solo a track',
      usage: 'solo <trackId>',
      fn: (trackId: string) => {
        if (!trackId) return 'Error: Track ID required.';
        controller.track.setSolo(trackId, true);
        return `Track ${trackId} soloed`;
      }
    },
    unsolo: {
      description: 'Unsolo a track',
      usage: 'unsolo <trackId>',
      fn: (trackId: string) => {
        if (!trackId) return 'Error: Track ID required.';
        controller.track.setSolo(trackId, false);
        return `Track ${trackId} unsoloed`;
      }
    },

    // ===== Region Management =====
    region: {
      description: 'Region management',
      usage: 'region split <trackId> <time> | region remove <trackId> <regionId>',
      fn: async (sub: string, trackId: string, arg: string) => {
        if (sub === 'split') {
          if (!trackId || !arg) return 'Error: Usage: region split <trackId> <time>';
          const time = parseFloat(arg);
          if (isNaN(time)) return 'Error: Invalid time value.';
          await controller.region.splitRegion(trackId, time);
          return `Region split at ${time} on track ${trackId}`;
        } else if (sub === 'remove') {
          if (!trackId || !arg) return 'Error: Usage: region remove <trackId> <regionId>';
          controller.region.removeRegion(trackId, arg);
          return `Region ${arg} removed from track ${trackId}`;
        }
        return 'Usage: region split <trackId> <time> OR region remove <trackId> <regionId>';
      }
    },

    // ===== Export =====
    export: {
      description: 'Export project',
      usage: 'export all | export range <start> <end>',
      fn: async (sub: string, start?: string, end?: string) => {
        if (sub === 'all') {
          await controller.export.exportProject();
          return 'Project exported successfully (all)';
        } else if (sub === 'range') {
          if (!start || !end) return 'Error: Usage: export range <start> <end>';
          const startTime = parseFloat(start);
          const endTime = parseFloat(end);
          if (isNaN(startTime) || isNaN(endTime)) return 'Error: Invalid time values.';
          await controller.export.exportRange(startTime, endTime);
          return `Project exported (${startTime}s - ${endTime}s)`;
        }
        return 'Usage: export all OR export range <start> <end>';
      }
    },

    // ===== Info Commands =====
    status: {
      description: 'Display current session status',
      usage: 'status',
      fn: () => {
        const statusText = state.isPlaying ? 'Playing' : 'Stopped';
        return `Status: ${statusText}\nTracks: ${state.trackCount}\nTime: ${state.currentTime.toFixed(2)}s\nTempo: ${state.tempo} BPM`;
      }
    },
    list: {
      description: 'List all tracks',
      usage: 'list',
      fn: () => {
        // tracks 정보를 가져오려면 session state를 직접 접근해야 할 수도 있음
        return 'Track list (use status for count)';
      }
    },
    help: {
      description: 'Show available commands',
      usage: 'help',
      fn: () => {
        const list = Object.entries(commands)
          .map(([name, cmd]) => `  ${name.padEnd(12)} - ${cmd.description}`)
          .join('\n');
        return 'Available commands:\n' + list + '\n\nType "<command> --help" for usage details.';
      }
    }
  };
  return commands;
};

export const useCliApp = () => {
  const controller = useController();
  const isPlaying = useSession(state => state.isPlaying);
  const trackCount = useSession(state => state.tracks.size);
  const currentTime = useSession(state => state.currentTime);
  const tempo = useSession(state => state.tempo);
  
  const commands = useMemo(
    () => createCliCommands(controller, { isPlaying, trackCount, currentTime, tempo }),
    [controller, isPlaying, trackCount, currentTime, tempo]
  );
  
  return { isPlaying, trackCount, currentTime, tempo, commands };
};
