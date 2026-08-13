import type { RegionState, SessionState, TrackState } from '../session/session';
import type { PluginInstanceState } from '../shared/types/plugin-state';
import type { TimelineMeterChange, TimelineTempoChange } from '../shared/timeline-coordinate-mapper';
import type { TimelineMarker } from '../shared/timeline-marker';
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

interface CreateInstallPluginCommandRequest {
  readonly trackId: string;
  readonly instance: PluginInstanceState;
  readonly targetIndex: number;
}

interface TimelineMapSnapshot {
  readonly tempoChanges: readonly TimelineTempoChange[];
  readonly meterChanges: readonly TimelineMeterChange[];
}

function createEntry({ executeCommand, label, redoCommand, undoCommand }: CreateEntryOptions): CommandHistoryEntry {
  return {
    label,
    undo: () => executeCommand(undoCommand),
    redo: () => executeCommand(redoCommand),
  };
}

function areTimelineMapsEqual(left: TimelineMapSnapshot, right: TimelineMapSnapshot): boolean {
  return (
    left.tempoChanges.length === right.tempoChanges.length &&
    left.meterChanges.length === right.meterChanges.length &&
    left.tempoChanges.every((change, index) => {
      const candidate = right.tempoChanges[index];
      return candidate?.quarterNotePosition === change.quarterNotePosition && candidate.bpm === change.bpm;
    }) &&
    left.meterChanges.every((change, index) => {
      const candidate = right.meterChanges[index];
      return (
        candidate?.quarterNotePosition === change.quarterNotePosition &&
        candidate.beatsPerBar === change.beatsPerBar &&
        candidate.beatUnit === change.beatUnit
      );
    })
  );
}

function areTimelineMarkersEqual(left: readonly TimelineMarker[], right: readonly TimelineMarker[]): boolean {
  return (
    left.length === right.length &&
    left.every((marker, index) => {
      const candidate = right[index];
      return (
        candidate?.id === marker.id &&
        candidate.name === marker.name &&
        candidate.quarterNotePosition === marker.quarterNotePosition
      );
    })
  );
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

function createInstallPluginCommand({
  trackId,
  instance,
  targetIndex,
}: CreateInstallPluginCommandRequest): AudioCommand {
  return {
    type: AudioCommandType.INSTALL_PLUGIN,
    trackId,
    instanceId: instance.id,
    manifestId: instance.manifestSummary.id,
    isEnabled: instance.isEnabled,
    targetIndex,
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

function createLoopRangeCommand(session: SessionState): AudioCommand {
  if (session.loopRange === null) {
    return { type: AudioCommandType.CLEAR_LOOP_RANGE };
  }
  return {
    type: AudioCommandType.SET_LOOP_RANGE,
    startTimeSeconds: session.loopRange.startTimeSeconds,
    endTimeSeconds: session.loopRange.endTimeSeconds,
    isEnabled: session.isLoopEnabled,
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

    case AudioCommandType.SET_TRACK_NAME: {
      const beforeTrack = beforeSession.tracks.get(command.trackId);
      const afterTrack = afterSession.tracks.get(command.trackId);
      if (!beforeTrack || !afterTrack || beforeTrack.name === afterTrack.name || afterTrack.name !== command.name) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: { ...command, name: beforeTrack.name },
        redoCommand: command,
      });
    }

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

    case AudioCommandType.SET_TIMELINE_MAP:
      if (areTimelineMapsEqual(beforeSession, afterSession) || !areTimelineMapsEqual(afterSession, command)) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: {
          type: AudioCommandType.SET_TIMELINE_MAP,
          tempoChanges: beforeSession.tempoChanges.map(change => ({ ...change })),
          meterChanges: beforeSession.meterChanges.map(change => ({ ...change })),
        },
        redoCommand: command,
      });

    case AudioCommandType.SET_TIMELINE_MARKERS:
      if (
        areTimelineMarkersEqual(beforeSession.timelineMarkers, afterSession.timelineMarkers) ||
        !areTimelineMarkersEqual(afterSession.timelineMarkers, command.markers)
      ) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: {
          type: AudioCommandType.SET_TIMELINE_MARKERS,
          markers: beforeSession.timelineMarkers.map(marker => ({ ...marker })),
        },
        redoCommand: command,
      });

    case AudioCommandType.SET_LOOP_RANGE:
    case AudioCommandType.CLEAR_LOOP_RANGE: {
      const isUnchanged =
        beforeSession.loopRange?.startTimeSeconds === afterSession.loopRange?.startTimeSeconds &&
        beforeSession.loopRange?.endTimeSeconds === afterSession.loopRange?.endTimeSeconds &&
        beforeSession.isLoopEnabled === afterSession.isLoopEnabled;
      if (isUnchanged) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        redoCommand: createLoopRangeCommand(afterSession),
        undoCommand: createLoopRangeCommand(beforeSession),
      });
    }

    case AudioCommandType.SET_LOOP_ENABLED:
      if (
        beforeSession.isLoopEnabled === afterSession.isLoopEnabled ||
        afterSession.isLoopEnabled !== command.isEnabled
      ) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        redoCommand: command,
        undoCommand: { type: AudioCommandType.SET_LOOP_ENABLED, isEnabled: beforeSession.isLoopEnabled },
      });

    case AudioCommandType.SET_METRONOME:
      if (
        (beforeSession.isMetronomeEnabled === afterSession.isMetronomeEnabled &&
          beforeSession.metronomeVolume === afterSession.metronomeVolume) ||
        afterSession.isMetronomeEnabled !== command.isEnabled ||
        afterSession.metronomeVolume !== command.volume
      ) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        redoCommand: command,
        undoCommand: {
          type: AudioCommandType.SET_METRONOME,
          isEnabled: beforeSession.isMetronomeEnabled,
          volume: beforeSession.metronomeVolume,
        },
      });

    case AudioCommandType.SET_MASTER_VOLUME:
      if (beforeSession.masterVolume === afterSession.masterVolume || afterSession.masterVolume !== command.volume) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: { type: AudioCommandType.SET_MASTER_VOLUME, volume: beforeSession.masterVolume },
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
        redoCommand: createInstallPluginCommand({
          trackId: command.trackId,
          instance: installedInstance.instance,
          targetIndex: installedInstance.track.pluginInstances.findIndex(
            instance => instance.id === installedInstance.instance.id
          ),
        }),
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
        undoCommand: createInstallPluginCommand({
          trackId: command.trackId,
          instance: removedInstance.instance,
          targetIndex: removedInstance.track.pluginInstances.findIndex(
            instance => instance.id === removedInstance.instance.id
          ),
        }),
        redoCommand: command,
      });
    }

    case AudioCommandType.MOVE_PLUGIN: {
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
      const beforeIndex = beforeInstance?.track.pluginInstances.findIndex(
        instance => instance.id === command.instanceId
      );
      const afterIndex = afterInstance?.track.pluginInstances.findIndex(instance => instance.id === command.instanceId);
      if (
        beforeIndex === undefined ||
        afterIndex === undefined ||
        beforeIndex < 0 ||
        beforeIndex === afterIndex ||
        afterIndex !== command.targetIndex
      ) {
        return null;
      }
      return createEntry({
        executeCommand,
        label: command.type,
        undoCommand: { ...command, targetIndex: beforeIndex },
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
    case AudioCommandType.SET_AUDIO_INPUT_DEVICE:
    case AudioCommandType.SET_INPUT_MONITORING:
    case AudioCommandType.SET_TRACK_RECORD_ARM:
    case AudioCommandType.START_RECORDING:
    case AudioCommandType.STOP_RECORDING:
    case AudioCommandType.CANCEL_RECORDING:
    case AudioCommandType.ARM_LOOP_SLOT:
    case AudioCommandType.ARM_LOOP_OVERDUB:
    case AudioCommandType.CANCEL_LOOP_SLOT:
    case AudioCommandType.TRIGGER_LOOP_SLOT:
    case AudioCommandType.STOP_LOOP_SLOT:
    case AudioCommandType.CLEAR_LOOP_SLOT:
    case AudioCommandType.STOP_ALL_LOOPS:
    case AudioCommandType.SET_CURRENT_TIME:
    case AudioCommandType.SPLIT_REGION:
    case AudioCommandType.EXPORT_AUDIO:
    case AudioCommandType.SAVE_PROJECT:
    case AudioCommandType.LOAD_PROJECT:
      return null;
  }
}
