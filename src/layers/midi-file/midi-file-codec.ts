import { parseMidiFile, writeMidiFile, type MidiWriteTrack } from '@daw-engine-source/browser-adapter';
import { BUILTIN_MIDI_INSTRUMENT_ID, type MidiNoteState, type MidiTrackState } from '../shared/types/midi-state';

const MIDI_FILE_SAMPLE_RATE = 1_000;
const MINIMUM_REGION_DURATION_SECONDS = 0.001;

export interface StandardMidiTrack {
  readonly midi: MidiTrackState;
  readonly name: string;
}

interface ParseStandardMidiFileRequest {
  readonly createId: () => string;
  readonly data: ArrayBuffer;
}

interface StandardMidiFileData {
  readonly tempoBpm: number;
  readonly tracks: readonly StandardMidiTrack[];
}

interface WriteStandardMidiFileRequest {
  readonly tempoBpm: number;
  readonly tracks: readonly StandardMidiTrack[];
}

function createImportedNote({
  channel,
  createId,
  durationFrames,
  pitch,
  startFrame,
  velocity,
}: {
  channel: number;
  createId: () => string;
  durationFrames: number;
  pitch: number;
  startFrame: number;
  velocity: number;
}): MidiNoteState {
  return {
    channel: channel + 1,
    durationSeconds: durationFrames / MIDI_FILE_SAMPLE_RATE,
    id: createId(),
    pitch,
    startOffsetSeconds: startFrame / MIDI_FILE_SAMPLE_RATE,
    velocity,
  };
}

export function parseStandardMidiFile({ createId, data }: ParseStandardMidiFileRequest): StandardMidiFileData {
  try {
    const parsed = parseMidiFile(data, MIDI_FILE_SAMPLE_RATE);
    const tracks = parsed.tracks.flatMap(track => {
      const notes = track.notes.map(note => createImportedNote({ ...note, createId }));
      if (notes.length === 0) {
        return [];
      }
      const durationSeconds = Math.max(
        MINIMUM_REGION_DURATION_SECONDS,
        ...notes.map(note => note.startOffsetSeconds + note.durationSeconds)
      );
      return [
        {
          midi: {
            instrumentId: BUILTIN_MIDI_INSTRUMENT_ID,
            regions: [
              {
                durationSeconds,
                id: createId(),
                name: track.name,
                notes,
                startTimeSeconds: 0,
              },
            ],
          },
          name: track.name,
        },
      ];
    });

    if (tracks.length === 0) {
      throw new Error('재생 가능한 note가 없습니다.');
    }
    return { tempoBpm: parsed.tempo, tracks };
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`유효한 MIDI 파일이 아닙니다: ${detail}`, { cause });
  }
}

function createMidiWriteTrack({ midi, name }: StandardMidiTrack): MidiWriteTrack {
  return {
    name,
    notes: midi.regions.flatMap(region =>
      region.notes.map(note => ({
        channel: note.channel - 1,
        durationFrames: Math.round(note.durationSeconds * MIDI_FILE_SAMPLE_RATE),
        pitch: note.pitch,
        startFrame: Math.round((region.startTimeSeconds + note.startOffsetSeconds) * MIDI_FILE_SAMPLE_RATE),
        velocity: note.velocity,
      }))
    ),
  };
}

export function writeStandardMidiFile({ tempoBpm, tracks }: WriteStandardMidiFileRequest): ArrayBuffer {
  return writeMidiFile(tracks.map(createMidiWriteTrack), {
    sampleRate: MIDI_FILE_SAMPLE_RATE,
    tempo: tempoBpm,
  });
}
