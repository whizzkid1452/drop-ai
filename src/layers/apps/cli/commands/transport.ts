import { AppController } from '@/layers/controllers';
import type { CliCommands, CliState } from '../types';

export const createTransportCommands = (
  controller: AppController,
  _state: CliState
): CliCommands => {
  return {
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
    }
  };
};
