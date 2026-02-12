import { AppController } from '@/layers/controllers';
import type { CliCommands, CliState } from '../../types';

export const createTrackCommands = (
  controller: AppController,
  _state: CliState
): CliCommands => {
  return {
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
    }
  };
};
