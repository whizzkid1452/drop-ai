import { useMemo } from 'react';
import type { CommandExecutor } from '../../commands/command-executor';
import { AudioCommandType } from '../../shared/types/audioCommand.schema';
import { useCommandExecutor, useSession } from '../web/context/layer-hooks';

export interface CliCommand {
  description: string;
  usage: string;
  fn: (...args: string[]) => string | Promise<string>;
}

export type CliCommands = Record<string, CliCommand>;
type CliCommandExecutor = Pick<CommandExecutor, 'execute' | 'executeMany'>;

const REGION_ADD_SOURCE_USAGE =
  'region add-source <trackId> <regionId> <sourceId> <startTime> <duration> [startOffset]';

interface CliState {
  isPlaying: boolean;
  trackCount: number;
  currentTime: number;
  tempo: number;
}

function parseFiniteNumber(value: string): number | null {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

async function executeTrackCommand(commandExecutor: CliCommandExecutor, args: string[]): Promise<string> {
  const [subcommand, trackId] = args;

  if (subcommand === 'add') {
    if (!trackId) {
      return 'Error: Usage: track add <trackId>';
    }
    await commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId });
    return `Track ${trackId} added.`;
  }

  if (subcommand === 'remove') {
    if (!trackId) {
      return 'Error: Track ID required.';
    }
    await commandExecutor.execute({ type: AudioCommandType.REMOVE_TRACK, trackId });
    return `Track ${trackId} removed.`;
  }

  return 'Usage: track add <trackId> OR track remove <trackId>';
}

async function executeRegionCommand(commandExecutor: CliCommandExecutor, args: string[]): Promise<string> {
  const [subcommand, trackId, regionId, value, startTimeValue, durationValue, startOffsetValue] = args;

  if (subcommand === 'add-source') {
    if (!trackId || !regionId || !value || !startTimeValue || !durationValue) {
      return `Error: Usage: ${REGION_ADD_SOURCE_USAGE}`;
    }

    const startTime = parseFiniteNumber(startTimeValue);
    const duration = parseFiniteNumber(durationValue);
    const startOffset = startOffsetValue ? parseFiniteNumber(startOffsetValue) : 0;
    if (
      startTime === null ||
      duration === null ||
      startOffset === null ||
      startTime < 0 ||
      duration <= 0 ||
      startOffset < 0
    ) {
      return 'Error: Region times must use finite numbers with duration greater than 0.';
    }

    await commandExecutor.execute({
      type: AudioCommandType.LOAD_REGION,
      trackId,
      regionId,
      sourceId: value,
      startTime,
      duration,
      startOffset,
    });
    return `Region ${regionId} added to track ${trackId}`;
  }

  if (subcommand === 'remove') {
    if (!trackId || !regionId) {
      return 'Error: Usage: region remove <trackId> <regionId>';
    }
    await commandExecutor.execute({ type: AudioCommandType.UNLOAD_REGION, trackId, regionId });
    return `Region ${regionId} removed from track ${trackId}`;
  }

  if (subcommand === 'split') {
    if (!trackId || !regionId || !value) {
      return 'Error: Usage: region split <trackId> <regionId> <time>';
    }
    const splitTime = parseFiniteNumber(value);
    if (splitTime === null || splitTime < 0) {
      return 'Error: Invalid split time value.';
    }
    await commandExecutor.execute({ type: AudioCommandType.SPLIT_REGION, trackId, regionId, splitTime });
    return `Region ${regionId} split at ${splitTime} on track ${trackId}`;
  }

  if (subcommand === 'move') {
    if (!trackId || !regionId || !value) {
      return 'Error: Usage: region move <trackId> <regionId> <newStartTime>';
    }
    const newStartTime = parseFiniteNumber(value);
    if (newStartTime === null || newStartTime < 0) {
      return 'Error: Invalid start time value.';
    }
    await commandExecutor.execute({ type: AudioCommandType.MOVE_REGION, trackId, regionId, newStartTime });
    return `Region ${regionId} moved to ${newStartTime} on track ${trackId}`;
  }

  return [
    'Usage:',
    REGION_ADD_SOURCE_USAGE,
    'region remove <trackId> <regionId>',
    'region split <trackId> <regionId> <time>',
    'region move <trackId> <regionId> <newStartTime>',
  ].join('\n');
}

async function executeExportCommand(commandExecutor: CliCommandExecutor, args: string[]): Promise<string> {
  const [subcommand, start, end] = args;

  if (subcommand === 'all') {
    await commandExecutor.executeMany([
      { type: AudioCommandType.CLEAR_EXPORT_RANGE },
      { type: AudioCommandType.EXPORT_AUDIO },
    ]);
    return 'Project exported successfully (all)';
  }

  if (subcommand === 'range') {
    if (!start || !end) {
      return 'Error: Usage: export range <start> <end>';
    }
    const startTime = parseFiniteNumber(start);
    const endTime = parseFiniteNumber(end);
    if (startTime === null || endTime === null) {
      return 'Error: Invalid time values.';
    }
    if (startTime < 0 || endTime <= startTime) {
      return 'Error: Export range must satisfy 0 <= start < end.';
    }
    await commandExecutor.executeMany([
      { type: AudioCommandType.SET_EXPORT_RANGE, startTime, endTime },
      { type: AudioCommandType.EXPORT_AUDIO },
    ]);
    return `Project exported (${startTime}s - ${endTime}s)`;
  }

  return 'Usage: export all OR export range <start> <end>';
}

export const createCliCommands = (commandExecutor: CliCommandExecutor, state: CliState): CliCommands => {
  const commands: CliCommands = {
    play: {
      description: 'Start audio playback',
      usage: 'play',
      fn: async () => {
        await commandExecutor.execute({ type: AudioCommandType.PLAY });
        return 'Playback started...';
      },
    },
    stop: {
      description: 'Stop audio playback',
      usage: 'stop',
      fn: async () => {
        await commandExecutor.execute({ type: AudioCommandType.STOP });
        return 'Playback stopped.';
      },
    },
    pause: {
      description: 'Pause audio playback',
      usage: 'pause',
      fn: async () => {
        await commandExecutor.execute({ type: AudioCommandType.PAUSE });
        return 'Playback paused.';
      },
    },
    save: {
      description: 'Save current project',
      usage: 'save',
      fn: async () => {
        await commandExecutor.execute({ type: AudioCommandType.SAVE_PROJECT });
        return 'Project saved.';
      },
    },
    seek: {
      description: 'Seek to specific time',
      usage: 'seek <time>',
      fn: async (time?: string) => {
        if (!time) {
          return 'Error: Time required. Usage: seek <time>';
        }
        const currentTime = parseFiniteNumber(time);
        if (currentTime === null || currentTime < 0) {
          return 'Error: Invalid time value.';
        }
        await commandExecutor.execute({ type: AudioCommandType.SET_CURRENT_TIME, time: currentTime });
        return `Seeked to ${currentTime}s`;
      },
    },
    tempo: {
      description: 'Set tempo (BPM)',
      usage: 'tempo <bpm>',
      fn: async (bpm?: string) => {
        if (!bpm) {
          return 'Error: BPM required. Usage: tempo <bpm>';
        }
        const tempo = parseFiniteNumber(bpm);
        if (tempo === null || tempo <= 0) {
          return 'Error: Invalid BPM value.';
        }
        await commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo });
        return `Tempo set to ${tempo} BPM`;
      },
    },
    track: {
      description: 'Track management',
      usage: 'track add <trackId> | track remove <trackId>',
      fn: (...args: string[]) => executeTrackCommand(commandExecutor, args),
    },
    volume: {
      description: 'Set track volume',
      usage: 'volume <trackId> <value>',
      fn: async (trackId?: string, value?: string) => {
        if (!trackId || !value) {
          return 'Error: Usage: volume <trackId> <value>';
        }
        const volume = parseFiniteNumber(value);
        if (volume === null || volume < 0 || volume > 1) {
          return 'Error: Volume must be between 0.0 and 1.0';
        }
        await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_VOLUME, trackId, volume });
        return `Volume for ${trackId} set to ${volume}`;
      },
    },
    pan: {
      description: 'Set track pan',
      usage: 'pan <trackId> <value>',
      fn: async (trackId?: string, value?: string) => {
        if (!trackId || !value) {
          return 'Error: Usage: pan <trackId> <value>';
        }
        const pan = parseFiniteNumber(value);
        if (pan === null || pan < -1 || pan > 1) {
          return 'Error: Pan must be between -1.0 and 1.0';
        }
        await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_PAN, trackId, pan });
        return `Pan for ${trackId} set to ${pan}`;
      },
    },
    mute: {
      description: 'Mute a track',
      usage: 'mute <trackId>',
      fn: async (trackId?: string) => {
        if (!trackId) {
          return 'Error: Track ID required.';
        }
        await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_MUTE, trackId, muted: true });
        return `Track ${trackId} muted`;
      },
    },
    unmute: {
      description: 'Unmute a track',
      usage: 'unmute <trackId>',
      fn: async (trackId?: string) => {
        if (!trackId) {
          return 'Error: Track ID required.';
        }
        await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_MUTE, trackId, muted: false });
        return `Track ${trackId} unmuted`;
      },
    },
    solo: {
      description: 'Solo a track',
      usage: 'solo <trackId>',
      fn: async (trackId?: string) => {
        if (!trackId) {
          return 'Error: Track ID required.';
        }
        await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_SOLO, trackId, soloed: true });
        return `Track ${trackId} soloed`;
      },
    },
    unsolo: {
      description: 'Unsolo a track',
      usage: 'unsolo <trackId>',
      fn: async (trackId?: string) => {
        if (!trackId) {
          return 'Error: Track ID required.';
        }
        await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_SOLO, trackId, soloed: false });
        return `Track ${trackId} unsoloed`;
      },
    },
    region: {
      description: 'Region management',
      usage: [
        REGION_ADD_SOURCE_USAGE,
        'region remove <trackId> <regionId>',
        'region split <trackId> <regionId> <time>',
        'region move <trackId> <regionId> <newStartTime>',
      ].join(' | '),
      fn: (...args: string[]) => executeRegionCommand(commandExecutor, args),
    },
    export: {
      description: 'Export project',
      usage: 'export all | export range <start> <end>',
      fn: (...args: string[]) => executeExportCommand(commandExecutor, args),
    },
    status: {
      description: 'Display current session status',
      usage: 'status',
      fn: () => {
        const statusText = state.isPlaying ? 'Playing' : 'Stopped';
        return `Status: ${statusText}\nTracks: ${state.trackCount}\nTime: ${state.currentTime.toFixed(2)}s\nTempo: ${state.tempo} BPM`;
      },
    },
    list: {
      description: 'List all tracks',
      usage: 'list',
      fn: () => 'Track list (use status for count)',
    },
    help: {
      description: 'Show available commands',
      usage: 'help',
      fn: () => {
        const commandList = Object.entries(commands)
          .map(([name, command]) => `  ${name.padEnd(12)} ${command.usage} - ${command.description}`)
          .join('\n');
        return `Available commands:\n${commandList}`;
      },
    },
  };
  return commands;
};

export const useCliApp = () => {
  const commandExecutor = useCommandExecutor();
  const isPlaying = useSession(state => state.isPlaying);
  const trackCount = useSession(state => state.tracks.size);
  const currentTime = useSession(state => state.currentTime);
  const tempo = useSession(state => state.tempo);

  const commands = useMemo(
    () => createCliCommands(commandExecutor, { isPlaying, trackCount, currentTime, tempo }),
    [commandExecutor, isPlaying, trackCount, currentTime, tempo]
  );

  return { isPlaying, trackCount, currentTime, tempo, commands };
};
