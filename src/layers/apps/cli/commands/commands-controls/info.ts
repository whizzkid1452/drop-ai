import { AppController } from '@/layers/controllers';
import type { CliCommands, CliState } from '../../types';

export const createInfoCommands = (
  _controller: AppController,
  state: CliState
): CliCommands => {
  return {
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
    }
  };
};
