import { useMemo } from 'react';
import { useController, useSession } from '../web/context/LayerContext';
import { AppController } from '@/layers/controllers';

export interface CliCommand {
  description: string;
  usage: string;
  fn: (...args: any[]) => string | Promise<string>;
}

export type CliCommands = Record<string, CliCommand>;

// Minimal Track interface for CLI usage
interface Track {
  id: string;
  regions: { id: string; startTime: number; endTime: number; duration: number; }[];
}

export const createCliCommands = (
  controller: AppController,
  state: { isPlaying: boolean; tracks: Map<string, Track>; currentTime: number; tempo: number }
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
      usage: 'track add <id> [url] | track remove <id>',
      fn: async (sub: string, id: string, url?: string) => {
        if (sub === 'add') {
          if (!id) return 'Error: Track ID required.';
          const trackUrl = url || 'mock-url';
          await controller.track.addTrack(trackUrl, id);
          return `Track ${id} added with URL: ${trackUrl}`;
        } else if (sub === 'remove') {
          if (!id) return 'Error: Track ID required.';
          controller.track.removeTrack(id);
          return 'Track ' + id + ' removed.';
        }
        return 'Usage: track add <id> [url] OR track remove <id>';
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
      usage: 'region split <trackId> <time> | region remove <trackId> <regionId> | region move <trackId> <regionId> <time> | region list <trackId>',
      fn: async (sub: string, trackId: string, arg1: string, arg2?: string) => {
        if (sub === 'split') {
          // arg1: time
          if (!trackId || !arg1) return 'Error: Usage: region split <trackId> <time>';
          const time = parseFloat(arg1);
          if (isNaN(time)) return 'Error: Invalid time value.';
          await controller.region.splitRegion(trackId, time);
          return `Region split at ${time} on track ${trackId}`;
        } else if (sub === 'remove') {
          // arg1: regionId
          if (!trackId || !arg1) return 'Error: Usage: region remove <trackId> <regionId>';
          controller.region.removeRegion(trackId, arg1);
          return `Region ${arg1} removed from track ${trackId}`;
        } else if (sub === 'move') {
          // arg1: regionId, arg2: time
          if (!trackId || !arg1 || !arg2) return 'Error: Usage: region move <trackId> <regionId> <time>';
          const time = parseFloat(arg2);
          if (isNaN(time)) return 'Error: Invalid time value.';
          controller.region.moveRegion({ trackId, regionId: arg1, newStartTime: time });
          return `Region ${arg1} moved to ${time}s on track ${trackId}`;
        } else if (sub === 'list') {
             if (!trackId) return 'Error: Track ID required.';
             const track = state.tracks.get(trackId);
             if (!track) return `Error: Track ${trackId} not found.`;
             if (track.regions.length === 0) return `Track ${trackId} has no regions.`;
             
             const list = track.regions.map(r => 
               `  [${r.id}] Start: ${r.startTime.toFixed(2)}s, Dur: ${r.duration.toFixed(2)}s`
             ).join('\n');
             return `Regions in ${trackId}:\n${list}`;
        }
        return 'Usage: region split... | remove... | move... | list...';
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
        return `Status: ${statusText}\nTracks: ${state.tracks.size}\nTime: ${state.currentTime.toFixed(2)}s\nTempo: ${state.tempo} BPM`;
      }
    },
    list: {
      description: 'List all tracks',
      usage: 'list',
      fn: () => {
        if (state.tracks.size === 0) return 'No tracks.';
        const list = Array.from(state.tracks.entries()).map(([id, t]) => 
             `  [${id}] Regions: ${t.regions.length}`
        ).join('\n');
        return `Track List (${state.tracks.size}):\n${list}`;
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
  const tracks = useSession(state => state.tracks);
  const currentTime = useSession(state => state.currentTime);
  const tempo = useSession(state => state.tempo);
  
  const commands = useMemo(
    () => createCliCommands(controller, { isPlaying, tracks, currentTime, tempo }),
    [controller, isPlaying, tracks, currentTime, tempo]
  );
  
  return { isPlaying, trackCount: tracks.size, currentTime, tempo, commands };
};
