import { CommandBatchExecutionError, type CommandExecutor } from '@/layers/commands/command-executor';
import { AudioCommandType, type AudioCommand } from '@/layers/shared/types/audioCommand.schema';
import { parseStandardMidiFile } from '@/layers/midi-file/midi-file-codec';

export class MidiFileImportCompensationError extends Error {
  readonly compensationFailures: readonly { cause: unknown; step: string }[];

  constructor(cause: unknown, compensationFailures: readonly { cause: unknown; step: string }[]) {
    super('MIDI 파일 가져오기 실패 후 일부 Track을 제거하지 못했습니다.', { cause });
    this.name = 'MidiFileImportCompensationError';
    this.compensationFailures = [...compensationFailures];
  }
}

interface ExecuteMidiFileImportRequest {
  readonly commandExecutor: Pick<CommandExecutor, 'execute' | 'executeMany'>;
  readonly createId: () => string;
  readonly file: File;
}

function createTrackCommands({
  midi,
  name,
  trackId,
}: {
  readonly midi: ReturnType<typeof parseStandardMidiFile>['tracks'][number]['midi'];
  readonly name: string;
  readonly trackId: string;
}): AudioCommand[] {
  return [
    { trackId, type: AudioCommandType.ADD_MIDI_TRACK },
    { name, trackId, type: AudioCommandType.SET_TRACK_NAME },
    {
      midi: {
        instrumentId: midi.instrumentId,
        regions: midi.regions.map(region => ({
          ...region,
          notes: region.notes.map(note => ({ ...note })),
        })),
      },
      trackId,
      type: AudioCommandType.SET_MIDI_TRACK_STATE,
    },
  ];
}

export async function executeMidiFileImport({
  commandExecutor,
  createId,
  file,
}: ExecuteMidiFileImportRequest): Promise<readonly string[]> {
  const parsed = parseStandardMidiFile({ createId, data: await file.arrayBuffer() });
  const trackIds = parsed.tracks.map(() => createId());
  const commands = parsed.tracks.flatMap((track, index) =>
    createTrackCommands({ ...track, trackId: trackIds[index] as string })
  );

  try {
    await commandExecutor.executeMany(commands);
    return trackIds;
  } catch (cause) {
    if (!(cause instanceof CommandBatchExecutionError)) {
      throw cause;
    }
    const addedTrackIds = commands
      .slice(0, cause.failedIndex)
      .filter(command => command.type === AudioCommandType.ADD_MIDI_TRACK)
      .map(command => command.trackId)
      .reverse();
    const compensationFailures: Array<{ cause: unknown; step: string }> = [];
    for (const trackId of addedTrackIds) {
      try {
        await commandExecutor.execute({ trackId, type: AudioCommandType.REMOVE_TRACK });
      } catch (compensationCause) {
        compensationFailures.push({ cause: compensationCause, step: `MIDI Track ${trackId} 제거` });
      }
    }
    if (compensationFailures.length > 0) {
      throw new MidiFileImportCompensationError(cause, compensationFailures);
    }
    throw cause;
  }
}
