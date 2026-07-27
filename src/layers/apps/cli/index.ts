import { useMemo } from 'react';
import type { CommandExecutor } from '../../commands/command-executor';
import type { PluginParameterValue } from '../../shared/types/plugin-state';
import type { LoopLengthBars } from '../../shared/loop-time';
import { AudioCommandSchema, AudioCommandType } from '../../shared/types/audioCommand.schema';
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
const PLUGIN_INSTALL_USAGE = 'plugin install <trackId> <manifestId> [instanceId]';
const PLUGIN_REMOVE_USAGE = 'plugin remove <trackId> <instanceId>';
const PLUGIN_MOVE_USAGE = 'plugin move <trackId> <instanceId> <targetIndex>';
const PLUGIN_ENABLE_USAGE = 'plugin enable <trackId> <instanceId> <true|false>';
const PLUGIN_SET_USAGE = 'plugin set <trackId> <instanceId> <parameterId> <number|boolean|string> <value>';
const LOOP_ARM_USAGE = 'loop arm <trackId> <slotId> [lengthBars] [quantizationBars]';
const INPUT_MONITOR_USAGE = 'input monitor <trackId> <true|false>';

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

function isPluginParameterValueType(valueType: string): valueType is 'number' | 'boolean' | 'string' {
  return valueType === 'number' || valueType === 'boolean' || valueType === 'string';
}

function parsePluginParameterValue(valueType: string, rawValue: string): PluginParameterValue | null {
  if (valueType === 'number') {
    return parseFiniteNumber(rawValue);
  }
  if (valueType === 'boolean') {
    if (rawValue === 'true') {
      return true;
    }
    return rawValue === 'false' ? false : null;
  }
  return rawValue;
}

function parseBoolean(rawValue: string): boolean | null {
  if (rawValue === 'true') {
    return true;
  }
  return rawValue === 'false' ? false : null;
}

function parseLoopLengthBars(rawValue: string | undefined, defaultValue: LoopLengthBars): LoopLengthBars | null {
  if (rawValue === undefined) {
    return defaultValue;
  }
  const parsedValue = Number(rawValue);
  return parsedValue === 1 || parsedValue === 2 || parsedValue === 4 || parsedValue === 8 ? parsedValue : null;
}

async function executeLoopCommand(commandExecutor: CliCommandExecutor, args: string[]): Promise<string> {
  const [subcommand, trackId, slotId, lengthBarsValue, quantizationBarsValue] = args;
  if (subcommand === 'stop-all') {
    await commandExecutor.execute({ type: AudioCommandType.STOP_ALL_LOOPS });
    return 'All loops scheduled to stop.';
  }
  if (!trackId || !slotId) {
    return `Error: Usage: ${LOOP_ARM_USAGE}`;
  }
  if (subcommand === 'arm') {
    const lengthBars = parseLoopLengthBars(lengthBarsValue, 1);
    const quantizationBars = parseLoopLengthBars(quantizationBarsValue, 1);
    if (lengthBars === null || quantizationBars === null) {
      return 'Error: Loop length and quantization must be 1, 2, 4, or 8 bars.';
    }
    await commandExecutor.execute({
      lengthBars,
      quantizationBars,
      slotId,
      trackId,
      type: AudioCommandType.ARM_LOOP_SLOT,
    });
    return `Loop slot ${slotId} armed.`;
  }

  const commandTypes = {
    cancel: AudioCommandType.CANCEL_LOOP_SLOT,
    clear: AudioCommandType.CLEAR_LOOP_SLOT,
    stop: AudioCommandType.STOP_LOOP_SLOT,
    trigger: AudioCommandType.TRIGGER_LOOP_SLOT,
  } as const;
  const type = commandTypes[subcommand as keyof typeof commandTypes];
  if (!type) {
    return `Error: Usage: ${LOOP_ARM_USAGE} | loop cancel|trigger|stop|clear <trackId> <slotId> | loop stop-all`;
  }
  await commandExecutor.execute({ slotId, trackId, type });
  return `Loop slot ${slotId} ${subcommand} requested.`;
}

async function executeInputCommand(commandExecutor: CliCommandExecutor, args: string[]): Promise<string> {
  const [subcommand, target, rawEnabled] = args;
  if (subcommand === 'device' && target) {
    await commandExecutor.execute({
      deviceId: target === 'default' ? null : target,
      type: AudioCommandType.SET_AUDIO_INPUT_DEVICE,
    });
    return `Audio input device set to ${target}.`;
  }
  if (subcommand === 'monitor' && target && rawEnabled) {
    const enabled = parseBoolean(rawEnabled);
    if (enabled === null) {
      return `Error: Usage: ${INPUT_MONITOR_USAGE}`;
    }
    await commandExecutor.execute({ enabled, trackId: target, type: AudioCommandType.SET_INPUT_MONITORING });
    return `Input monitoring for ${target} set to ${enabled}.`;
  }
  return `Error: Usage: input device <deviceId|default> | ${INPUT_MONITOR_USAGE}`;
}

async function executeTrackCommand(commandExecutor: CliCommandExecutor, args: string[]): Promise<string> {
  const [subcommand, trackId, ...remainingArgs] = args;

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

  if (subcommand === 'rename') {
    if (!trackId || remainingArgs.length === 0) {
      return 'Error: Usage: track rename <trackId> <name>';
    }
    const name = remainingArgs.join(' ').trim();
    if (name === '') {
      return 'Error: Usage: track rename <trackId> <name>';
    }
    await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_NAME, trackId, name });
    return `Track ${trackId} renamed to ${name}.`;
  }

  return 'Usage: track add <trackId> OR track remove <trackId> OR track rename <trackId> <name>';
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

async function executePluginInstall(commandExecutor: CliCommandExecutor, args: string[]): Promise<string> {
  const [trackId, manifestId, instanceId] = args;
  if (!trackId || !manifestId) {
    return `Error: Usage: ${PLUGIN_INSTALL_USAGE}`;
  }
  await commandExecutor.execute({
    type: AudioCommandType.INSTALL_PLUGIN,
    trackId,
    manifestId,
    ...(instanceId ? { instanceId } : {}),
  });
  return `Plugin ${instanceId ?? manifestId} installed on track ${trackId}`;
}

async function executePluginRemove(commandExecutor: CliCommandExecutor, args: string[]): Promise<string> {
  const [trackId, instanceId] = args;
  if (!trackId || !instanceId) {
    return `Error: Usage: ${PLUGIN_REMOVE_USAGE}`;
  }
  await commandExecutor.execute({
    type: AudioCommandType.REMOVE_PLUGIN,
    trackId,
    instanceId,
  });
  return `Plugin ${instanceId} removed from track ${trackId}`;
}

async function executePluginMove(commandExecutor: CliCommandExecutor, args: string[]): Promise<string> {
  const [trackId, instanceId, targetIndexValue] = args;
  if (!trackId || !instanceId || targetIndexValue === undefined) {
    return `Error: Usage: ${PLUGIN_MOVE_USAGE}`;
  }
  const targetIndex = parseFiniteNumber(targetIndexValue);
  if (targetIndex === null || !Number.isInteger(targetIndex) || targetIndex < 0) {
    return 'Error: Plugin target index must be a non-negative integer.';
  }
  await commandExecutor.execute({
    type: AudioCommandType.MOVE_PLUGIN,
    trackId,
    instanceId,
    targetIndex,
  });
  return `Plugin ${instanceId} moved to index ${targetIndex} on track ${trackId}`;
}

async function executePluginSet(commandExecutor: CliCommandExecutor, args: string[]): Promise<string> {
  const [trackId, instanceId, parameterId, valueType, rawValue] = args;
  if (!trackId || !instanceId || !parameterId || !valueType || rawValue === undefined) {
    return `Error: Usage: ${PLUGIN_SET_USAGE}`;
  }
  if (!isPluginParameterValueType(valueType)) {
    return 'Error: Plugin Parameter value type must be number, boolean, or string.';
  }
  const value = parsePluginParameterValue(valueType, rawValue);
  if (value === null) {
    return 'Error: Plugin Parameter value must match its declared CLI type.';
  }
  await commandExecutor.execute({
    type: AudioCommandType.SET_PLUGIN_PARAMETER,
    trackId,
    instanceId,
    parameterId,
    value,
  });
  return `Plugin ${instanceId} Parameter ${parameterId} set to ${rawValue}`;
}

async function executePluginEnable(commandExecutor: CliCommandExecutor, args: string[]): Promise<string> {
  const [trackId, instanceId, rawValue] = args;
  if (!trackId || !instanceId || rawValue === undefined) {
    return `Error: Usage: ${PLUGIN_ENABLE_USAGE}`;
  }
  const isEnabled = parseBoolean(rawValue);
  if (isEnabled === null) {
    return 'Error: Plugin enabled state must be true or false.';
  }
  await commandExecutor.execute({
    type: AudioCommandType.SET_PLUGIN_ENABLED,
    trackId,
    instanceId,
    isEnabled,
  });
  return `Plugin ${instanceId} enabled state set to ${rawValue}`;
}

async function executePluginCommand(commandExecutor: CliCommandExecutor, args: string[]): Promise<string> {
  const [subcommand, ...subcommandArgs] = args;
  if (subcommand === 'install') {
    return executePluginInstall(commandExecutor, subcommandArgs);
  }
  if (subcommand === 'remove') {
    return executePluginRemove(commandExecutor, subcommandArgs);
  }
  if (subcommand === 'move') {
    return executePluginMove(commandExecutor, subcommandArgs);
  }
  if (subcommand === 'enable') {
    return executePluginEnable(commandExecutor, subcommandArgs);
  }
  if (subcommand === 'set') {
    return executePluginSet(commandExecutor, subcommandArgs);
  }
  return [
    'Usage:',
    PLUGIN_INSTALL_USAGE,
    PLUGIN_REMOVE_USAGE,
    PLUGIN_MOVE_USAGE,
    PLUGIN_ENABLE_USAGE,
    PLUGIN_SET_USAGE,
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
    undo: {
      description: 'Undo the last edit',
      usage: 'undo',
      fn: async () => {
        await commandExecutor.execute({ type: AudioCommandType.UNDO });
        return 'Edit undone.';
      },
    },
    redo: {
      description: 'Redo the last undone edit',
      usage: 'redo',
      fn: async () => {
        await commandExecutor.execute({ type: AudioCommandType.REDO });
        return 'Edit redone.';
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
    'load-project': {
      description: 'Load a saved project',
      usage: 'load-project <projectId>',
      fn: async (projectId?: string) => {
        const command = { type: AudioCommandType.LOAD_PROJECT, projectId };
        const validatedCommand = AudioCommandSchema.safeParse(command);
        if (!validatedCommand.success || validatedCommand.data.type !== AudioCommandType.LOAD_PROJECT) {
          return 'Error: Usage: load-project <projectId>';
        }
        await commandExecutor.execute(validatedCommand.data);
        return `Project ${validatedCommand.data.projectId} loaded.`;
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
    'master-volume': {
      description: 'Set master output volume',
      usage: 'master-volume <value>',
      fn: async (value?: string) => {
        const volume = value === undefined ? null : parseFiniteNumber(value);
        if (volume === null || volume < 0 || volume > 1) {
          return 'Error: Master volume must be between 0.0 and 1.0';
        }
        await commandExecutor.execute({ type: AudioCommandType.SET_MASTER_VOLUME, volume });
        return `Master volume set to ${volume}`;
      },
    },
    track: {
      description: 'Track management',
      usage: 'track add <trackId> | track remove <trackId> | track rename <trackId> <name>',
      fn: (...args: string[]) => executeTrackCommand(commandExecutor, args),
    },
    loop: {
      description: 'Live loop slot control',
      usage: `${LOOP_ARM_USAGE} | loop cancel|trigger|stop|clear <trackId> <slotId> | loop stop-all`,
      fn: (...args: string[]) => executeLoopCommand(commandExecutor, args),
    },
    input: {
      description: 'Live audio input control',
      usage: `input device <deviceId|default> | ${INPUT_MONITOR_USAGE}`,
      fn: (...args: string[]) => executeInputCommand(commandExecutor, args),
    },
    plugin: {
      description: 'Plugin management',
      usage: [PLUGIN_INSTALL_USAGE, PLUGIN_REMOVE_USAGE, PLUGIN_MOVE_USAGE, PLUGIN_ENABLE_USAGE, PLUGIN_SET_USAGE].join(
        ' | '
      ),
      fn: (...args: string[]) => executePluginCommand(commandExecutor, args),
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
