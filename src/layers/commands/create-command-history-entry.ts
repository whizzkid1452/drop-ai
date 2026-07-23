import type { RegionState, SessionState, TrackState } from '../session/session';
import type { PluginInstanceState } from '../shared/types/plugin-state';
import { AudioCommandType, type AudioCommand } from '../shared/types/audioCommand.schema';
import type { CommandHistoryEntry } from './command-history';

interface CreateCommandHistoryEntryOptions {
  readonly afterSession: SessionState;
  readonly beforeSession: SessionState;
  readonly command: AudioCommand;
  readonly executeCommand: (command: AudioCommand) => Promise<void>;
}

interface CreateEntryOptions {
  readonly executeCommand: (command: AudioCommand) => Promise<void>;
  readonly label: string;
  readonly redoCommand: AudioCommand;
  readonly undoCommand: AudioCommand;
}

interface LocatedRegion {
  readonly region: RegionState;
  readonly track: TrackState;
}

interface LocatedPluginInstance {
  readonly instance: PluginInstanceState;
  readonly track: TrackState;
}

interface FindPluginInstanceRequest {
  readonly session: SessionState;
  readonly trackId: string;
  readonly instanceId: string;
}

function createEntry({ executeCommand, label, redoCommand, undoCommand }: CreateEntryOptions): CommandHistoryEntry {
  return {
    label,
    undo: () => executeCommand(undoCommand),
    redo: () => executeCommand(redoCommand),
  };
}

function findRegion(session: SessionState, regionId: string, trackId?: string): LocatedRegion | null {
  if (trackId) {
    const track = session.tracks.get(trackId);
    const region = track?.regions.find(candidate => candidate.id === regionId);
    return track && region ? { region, track } : null;
  }

  let locatedRegion: LocatedRegion | null = null;
  for (const track of session.tracks.values()) {
    const region = track.regions.find(candidate => candidate.id === regionId);
    if (region) {
      if (locatedRegion) {
        return null;
      }
      locatedRegion = { region, track };
    }
  }

  return locatedRegion;
}

function createLoadRegionCommand(trackId: string, region: RegionState): AudioCommand {
  return {
    type: AudioCommandType.LOAD_REGION,
    trackId,
    regionId: region.id,
    sourceId: region.sourceId,
    startTime: region.startTime,
    startOffset: region.sourceStartTime,
    duration: region.duration,
  };
}

function findPluginInstance({ session, trackId, instanceId }: FindPluginInstanceRequest): LocatedPluginInstance | null {
  const track = session.tracks.get(trackId);
  const instance = track?.pluginInstances.find(candidate => candidate.id === instanceId);
  return track && instance ? { instance, track } : null;
}

function createInstallPluginCommand(trackId: string, instance: PluginInstanceState): AudioCommand {
  return {
    type: AudioCommandType.INSTALL_PLUGIN,
    trackId,
    instanceId: instance.id,
    manifestId: instance.manifestSummary.id,
    isEnabled: instance.isEnabled,
    parameterValues: Object.fromEntries(instance.parameters.map(parameter => [parameter.id, parameter.value])),
  };
}

function createExportRangeCommand(session: SessionState): AudioCommand | null {
  if (session.exportStartTime === null && session.exportEndTime === null) {
    return { type: AudioCommandType.CLEAR_EXPORT_RANGE };
  }
  if (session.exportStartTime === null || session.exportEndTime === null) {
    return null;
  }
  return {
    type: AudioCommandType.SET_EXPORT_RANGE,
    startTime: session.exportStartTime,
    endTime: session.exportEndTime,
  };
}

export function createCommandHistoryEntry({
  afterSession,
  beforeSession,
  command,
  executeCommand,
}: CreateCommandHistoryEntryOptions): CommandHistoryEntry | null {
  switch (command.type) {
    case AudioCommandType.ADD_TRACK:
      if (beforeSession.tracks.has(command.trackId) || !afterSession.tracks.has(command.trackId)) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: { type: AudioCommandType.REMOVE_TRACK, trackId: command.trackId },
        redoCommand: command,
      });

    case AudioCommandType.SET_TEMPO:
      if (beforeSession.tempo === afterSession.tempo || afterSession.tempo !== command.tempo) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: { type: AudioCommandType.SET_TEMPO, tempo: beforeSession.tempo },
        redoCommand: command,
      });

    case AudioCommandType.SET_TRACK_VOLUME: {
      const beforeTrack = command.trackId ? beforeSession.tracks.get(command.trackId) : undefined;
      const afterTrack = command.trackId ? afterSession.tracks.get(command.trackId) : undefined;
      if (
        !beforeTrack ||
        !afterTrack ||
        beforeTrack.volume === afterTrack.volume ||
        afterTrack.volume !== command.volume
      ) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: {
          type: AudioCommandType.SET_TRACK_VOLUME,
          trackId: beforeTrack.id,
          volume: beforeTrack.volume,
        },
        redoCommand: command,
      });
    }

    case AudioCommandType.SET_TRACK_PAN: {
      const beforeTrack = command.trackId ? beforeSession.tracks.get(command.trackId) : undefined;
      const afterTrack = command.trackId ? afterSession.tracks.get(command.trackId) : undefined;
      if (!beforeTrack || !afterTrack || beforeTrack.pan === afterTrack.pan || afterTrack.pan !== command.pan) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: { type: AudioCommandType.SET_TRACK_PAN, trackId: beforeTrack.id, pan: beforeTrack.pan },
        redoCommand: command,
      });
    }

    case AudioCommandType.SET_TRACK_MUTE: {
      const beforeTrack = beforeSession.tracks.get(command.trackId);
      const afterTrack = afterSession.tracks.get(command.trackId);
      if (
        !beforeTrack ||
        !afterTrack ||
        beforeTrack.isMuted === afterTrack.isMuted ||
        afterTrack.isMuted !== command.muted
      ) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: {
          type: AudioCommandType.SET_TRACK_MUTE,
          trackId: beforeTrack.id,
          muted: beforeTrack.isMuted,
        },
        redoCommand: command,
      });
    }

    case AudioCommandType.SET_TRACK_SOLO: {
      const beforeTrack = beforeSession.tracks.get(command.trackId);
      const afterTrack = afterSession.tracks.get(command.trackId);
      if (
        !beforeTrack ||
        !afterTrack ||
        beforeTrack.isSoloed === afterTrack.isSoloed ||
        afterTrack.isSoloed !== command.soloed
      ) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: {
          type: AudioCommandType.SET_TRACK_SOLO,
          trackId: beforeTrack.id,
          soloed: beforeTrack.isSoloed,
        },
        redoCommand: command,
      });
    }

    case AudioCommandType.INSTALL_PLUGIN: {
      const installedInstance = command.instanceId
        ? findPluginInstance({ session: afterSession, trackId: command.trackId, instanceId: command.instanceId })
        : null;
      if (
        !installedInstance ||
        findPluginInstance({
          session: beforeSession,
          trackId: command.trackId,
          instanceId: installedInstance.instance.id,
        })
      ) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: {
          type: AudioCommandType.REMOVE_PLUGIN,
          trackId: command.trackId,
          instanceId: installedInstance.instance.id,
        },
        redoCommand: createInstallPluginCommand(command.trackId, installedInstance.instance),
      });
    }

    case AudioCommandType.REMOVE_PLUGIN: {
      const removedInstance = findPluginInstance({
        session: beforeSession,
        trackId: command.trackId,
        instanceId: command.instanceId,
      });
      if (
        !removedInstance ||
        findPluginInstance({ session: afterSession, trackId: command.trackId, instanceId: command.instanceId })
      ) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: createInstallPluginCommand(command.trackId, removedInstance.instance),
        redoCommand: command,
      });
    }

    case AudioCommandType.SET_PLUGIN_PARAMETER: {
      const beforeInstance = findPluginInstance({
        session: beforeSession,
        trackId: command.trackId,
        instanceId: command.instanceId,
      });
      const afterInstance = findPluginInstance({
        session: afterSession,
        trackId: command.trackId,
        instanceId: command.instanceId,
      });
      const beforeParameter = beforeInstance?.instance.parameters.find(
        parameter => parameter.id === command.parameterId
      );
      const afterParameter = afterInstance?.instance.parameters.find(parameter => parameter.id === command.parameterId);
      if (
        !beforeParameter ||
        !afterParameter ||
        beforeParameter.value === afterParameter.value ||
        afterParameter.value !== command.value
      ) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: { ...command, value: beforeParameter.value },
        redoCommand: command,
      });
    }

    case AudioCommandType.SET_PLUGIN_ENABLED: {
      const beforeInstance = findPluginInstance({
        session: beforeSession,
        trackId: command.trackId,
        instanceId: command.instanceId,
      });
      const afterInstance = findPluginInstance({
        session: afterSession,
        trackId: command.trackId,
        instanceId: command.instanceId,
      });
      if (
        !beforeInstance ||
        !afterInstance ||
        beforeInstance.instance.isEnabled === afterInstance.instance.isEnabled ||
        afterInstance.instance.isEnabled !== command.isEnabled
      ) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: { ...command, isEnabled: beforeInstance.instance.isEnabled },
        redoCommand: command,
      });
    }

    case AudioCommandType.LOAD_REGION: {
      const locatedRegion = command.regionId ? findRegion(afterSession, command.regionId, command.trackId) : null;
      if (!locatedRegion || findRegion(beforeSession, locatedRegion.region.id, locatedRegion.track.id)) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: {
          type: AudioCommandType.UNLOAD_REGION,
          trackId: locatedRegion.track.id,
          regionId: locatedRegion.region.id,
        },
        redoCommand: createLoadRegionCommand(locatedRegion.track.id, locatedRegion.region),
      });
    }

    case AudioCommandType.UNLOAD_REGION: {
      const locatedRegion = command.regionId ? findRegion(beforeSession, command.regionId, command.trackId) : null;
      if (!locatedRegion || findRegion(afterSession, locatedRegion.region.id, locatedRegion.track.id)) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: createLoadRegionCommand(locatedRegion.track.id, locatedRegion.region),
        redoCommand: {
          type: AudioCommandType.UNLOAD_REGION,
          trackId: locatedRegion.track.id,
          regionId: locatedRegion.region.id,
        },
      });
    }

    case AudioCommandType.MOVE_REGION: {
      const beforeRegion = findRegion(beforeSession, command.regionId, command.trackId);
      const afterRegion = findRegion(afterSession, command.regionId, command.trackId);
      if (
        !beforeRegion ||
        !afterRegion ||
        beforeRegion.region.startTime === afterRegion.region.startTime ||
        afterRegion.region.startTime !== command.newStartTime
      ) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: {
          type: AudioCommandType.MOVE_REGION,
          trackId: command.trackId,
          regionId: command.regionId,
          newStartTime: beforeRegion.region.startTime,
        },
        redoCommand: command,
      });
    }

    case AudioCommandType.SET_EXPORT_RANGE:
    case AudioCommandType.CLEAR_EXPORT_RANGE: {
      const undoCommand = createExportRangeCommand(beforeSession);
      const redoCommand = createExportRangeCommand(afterSession);
      const isUnchanged =
        beforeSession.exportStartTime === afterSession.exportStartTime &&
        beforeSession.exportEndTime === afterSession.exportEndTime;
      if (!undoCommand || !redoCommand || isUnchanged) {
        return null;
      }
      return createEntry({ executeCommand, label: command.type, undoCommand, redoCommand });
    }

    case AudioCommandType.UNDO:
    case AudioCommandType.REDO:
    case AudioCommandType.REMOVE_TRACK:
    case AudioCommandType.PLAY:
    case AudioCommandType.PAUSE:
    case AudioCommandType.STOP:
    case AudioCommandType.SET_CURRENT_TIME:
    case AudioCommandType.SPLIT_REGION:
    case AudioCommandType.EXPORT_AUDIO:
    case AudioCommandType.SAVE_PROJECT:
    case AudioCommandType.LOAD_PROJECT:
      return null;
  }
}
