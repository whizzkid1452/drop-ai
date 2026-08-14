import { cloneMidiTrackState, type MidiNoteState, type MidiTrackState } from './types/midi-state';

interface MidiNoteEditRequest {
  readonly midi: MidiTrackState;
  readonly noteIds: readonly string[];
  readonly regionId: string;
}

interface QuantizeMidiNotesRequest extends MidiNoteEditRequest {
  readonly stepSeconds: number;
}

interface TransposeMidiNotesRequest extends MidiNoteEditRequest {
  readonly semitones: number;
}

function getSelectedNotes(request: MidiNoteEditRequest): readonly MidiNoteState[] {
  const region = request.midi.regions.find(candidate => candidate.id === request.regionId);
  if (!region) {
    throw new RangeError(`MIDI Region을 찾을 수 없습니다: ${request.regionId}`);
  }
  const noteIds = new Set(request.noteIds);
  const selectedNotes = region.notes.filter(note => noteIds.has(note.id));
  if (selectedNotes.length !== noteIds.size) {
    throw new RangeError('선택한 MIDI Note를 모두 찾을 수 없습니다.');
  }
  return selectedNotes;
}

export function quantizeMidiNotes(request: QuantizeMidiNotesRequest) {
  if (!Number.isFinite(request.stepSeconds) || request.stepSeconds <= 0) {
    throw new RangeError('Quantize step은 0보다 큰 유한한 초 단위 값이어야 합니다.');
  }
  getSelectedNotes(request);
  const noteIds = new Set(request.noteIds);
  const midi = cloneMidiTrackState(request.midi);
  return {
    ...midi,
    regions: midi.regions.map(region =>
      region.id === request.regionId
        ? {
            ...region,
            notes: region.notes.map(note => {
              if (!noteIds.has(note.id)) {
                return note;
              }
              const gridTimeSeconds = Math.round(note.startOffsetSeconds / request.stepSeconds) * request.stepSeconds;
              const latestStartTimeSeconds = region.durationSeconds - note.durationSeconds;
              return { ...note, startOffsetSeconds: Math.min(latestStartTimeSeconds, Math.max(0, gridTimeSeconds)) };
            }),
          }
        : region
    ),
  };
}

export function transposeMidiNotes(request: TransposeMidiNotesRequest) {
  if (!Number.isInteger(request.semitones)) {
    throw new RangeError('Transpose 값은 정수 반음 단위여야 합니다.');
  }
  const selectedNotes = getSelectedNotes(request);
  if (selectedNotes.some(note => note.pitch + request.semitones < 0 || note.pitch + request.semitones > 127)) {
    throw new RangeError('Transpose 결과가 MIDI pitch 범위 0..127을 벗어납니다.');
  }
  const noteIds = new Set(request.noteIds);
  const midi = cloneMidiTrackState(request.midi);
  return {
    ...midi,
    regions: midi.regions.map(region =>
      region.id === request.regionId
        ? {
            ...region,
            notes: region.notes.map(note =>
              noteIds.has(note.id) ? { ...note, pitch: note.pitch + request.semitones } : note
            ),
          }
        : region
    ),
  };
}
