import { Fragment, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import type { MidiNoteState, MidiRegionState, MidiTrackState } from '@/layers/shared/types/midi-state';
import * as styles from './PianoRollEditor.css.ts';

const NOTE_STEP_SECONDS = 0.25;
const DEFAULT_NOTE_DURATION_SECONDS = 0.5;
const DEFAULT_REGION_DURATION_SECONDS = 4;
const DEFAULT_PITCH = 60;
const DEFAULT_VELOCITY = 100;
const LOWEST_VISIBLE_PITCH = 36;
const HIGHEST_VISIBLE_PITCH = 84;
const VISIBLE_PITCH_COUNT = HIGHEST_VISIBLE_PITCH - LOWEST_VISIBLE_PITCH + 1;

interface PianoRollEditorProps {
  readonly editPointSeconds: number;
  readonly midi: MidiTrackState;
  readonly onChange: (midi: MidiTrackState) => Promise<void>;
  readonly regionId: string | null;
  readonly trackName: string;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function cloneWithRegion(midi: MidiTrackState, nextRegion: MidiRegionState): MidiTrackState {
  return {
    instrumentId: midi.instrumentId,
    recordMode: midi.recordMode,
    regions: midi.regions.map(region => (region.id === nextRegion.id ? nextRegion : region)),
  };
}

function expandRegionForNotes(region: MidiRegionState, notes: readonly MidiNoteState[]): MidiRegionState {
  const notesEndTime = Math.max(0, ...notes.map(note => note.startOffsetSeconds + note.durationSeconds));
  return {
    ...region,
    durationSeconds: Math.max(region.durationSeconds, notesEndTime),
    notes,
  };
}

export function PianoRollEditor({ editPointSeconds, midi, onChange, regionId, trackName }: PianoRollEditorProps) {
  const region = midi.regions.find(candidate => candidate.id === regionId) ?? null;
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(region?.notes[0]?.id ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedNote = region?.notes.find(note => note.id === selectedNoteId) ?? null;

  const commit = async (nextMidi: MidiTrackState) => {
    setErrorMessage(null);
    try {
      await onChange(nextMidi);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const addNote = async () => {
    const noteId = crypto.randomUUID();
    if (!region) {
      const startOffsetSeconds = Math.max(0, editPointSeconds);
      const newRegion: MidiRegionState = {
        controlLanes: [],
        durationSeconds: Math.max(DEFAULT_REGION_DURATION_SECONDS, startOffsetSeconds + DEFAULT_NOTE_DURATION_SECONDS),
        id: crypto.randomUUID(),
        name: 'MIDI Region',
        notes: [
          {
            channel: 1,
            durationSeconds: DEFAULT_NOTE_DURATION_SECONDS,
            id: noteId,
            pitch: DEFAULT_PITCH,
            startOffsetSeconds,
            velocity: DEFAULT_VELOCITY,
          },
        ],
        startTimeSeconds: 0,
      };
      setSelectedNoteId(noteId);
      await commit({
        instrumentId: midi.instrumentId,
        recordMode: midi.recordMode,
        regions: [...midi.regions, newRegion],
      });
      return;
    }

    const note: MidiNoteState = {
      channel: 1,
      durationSeconds: DEFAULT_NOTE_DURATION_SECONDS,
      id: noteId,
      pitch: DEFAULT_PITCH,
      startOffsetSeconds: Math.max(0, editPointSeconds - region.startTimeSeconds),
      velocity: DEFAULT_VELOCITY,
    };
    setSelectedNoteId(note.id);
    await commit(cloneWithRegion(midi, expandRegionForNotes(region, [...region.notes, note])));
  };

  const updateNote = async (noteId: string, changes: Partial<MidiNoteState>) => {
    if (!region) {
      return;
    }
    const notes = region.notes.map(note => (note.id === noteId ? { ...note, ...changes } : note));
    await commit(cloneWithRegion(midi, expandRegionForNotes(region, notes)));
  };

  const removeNote = async (noteId: string) => {
    if (!region) {
      return;
    }
    setSelectedNoteId(null);
    await commit(cloneWithRegion(midi, { ...region, notes: region.notes.filter(note => note.id !== noteId) }));
  };

  const handleNoteKeyDown = (event: KeyboardEvent<HTMLButtonElement>, note: MidiNoteState) => {
    const horizontalStep = event.key === 'ArrowLeft' ? -NOTE_STEP_SECONDS : NOTE_STEP_SECONDS;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      void removeNote(note.id);
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const pitchStep = event.key === 'ArrowUp' ? 1 : -1;
      void updateNote(note.id, { pitch: clamp(note.pitch + pitchStep, 0, 127) });
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    if (event.shiftKey) {
      void updateNote(note.id, {
        durationSeconds: Math.max(NOTE_STEP_SECONDS, note.durationSeconds + horizontalStep),
      });
      return;
    }
    void updateNote(note.id, { startOffsetSeconds: Math.max(0, note.startOffsetSeconds + horizontalStep) });
  };

  const updateSelectedNumber = (field: keyof MidiNoteState, event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedNote) {
      return;
    }
    const parsedValue = Number(event.target.value);
    if (!Number.isFinite(parsedValue)) {
      return;
    }
    const normalizedValue = (() => {
      switch (field) {
        case 'pitch':
          return Math.round(clamp(parsedValue, 0, 127));
        case 'velocity':
          return Math.round(clamp(parsedValue, 1, 127));
        case 'durationSeconds':
          return Math.max(NOTE_STEP_SECONDS, parsedValue);
        case 'startOffsetSeconds':
          return Math.max(0, parsedValue);
        default:
          return parsedValue;
      }
    })();
    void updateNote(selectedNote.id, { [field]: normalizedValue });
  };

  const rollDuration = Math.max(DEFAULT_REGION_DURATION_SECONDS, region?.durationSeconds ?? 0);

  return (
    <Fragment>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <strong>PIANO ROLL</strong>
          <button
            type="button"
            className={styles.button}
            aria-label={`${trackName} MIDI note 추가`}
            onClick={() => void addNote()}
          >
            + NOTE
          </button>
        </div>
        <span className={styles.help}>방향키: 이동 · Shift+좌우: 길이 · Delete: 삭제</span>
        {selectedNote ? (
          <div className={styles.inspector}>
            <label className={styles.inspectorLabel}>
              PITCH
              <input
                aria-label={`${trackName} note pitch`}
                className={styles.inspectorInput}
                max={127}
                min={0}
                onChange={event => updateSelectedNumber('pitch', event)}
                type="number"
                value={selectedNote.pitch}
              />
            </label>
            <label className={styles.inspectorLabel}>
              START
              <input
                aria-label={`${trackName} note 시작`}
                className={styles.inspectorInput}
                min={0}
                onChange={event => updateSelectedNumber('startOffsetSeconds', event)}
                step={NOTE_STEP_SECONDS}
                type="number"
                value={selectedNote.startOffsetSeconds}
              />
            </label>
            <label className={styles.inspectorLabel}>
              LENGTH
              <input
                aria-label={`${trackName} note 길이`}
                className={styles.inspectorInput}
                min={NOTE_STEP_SECONDS}
                onChange={event => updateSelectedNumber('durationSeconds', event)}
                step={NOTE_STEP_SECONDS}
                type="number"
                value={selectedNote.durationSeconds}
              />
            </label>
            <label className={styles.inspectorLabel}>
              VELOCITY
              <input
                aria-label={`${trackName} note velocity`}
                className={styles.inspectorInput}
                max={127}
                min={1}
                onChange={event => updateSelectedNumber('velocity', event)}
                type="range"
                value={selectedNote.velocity}
              />
            </label>
          </div>
        ) : null}
        {errorMessage ? <span className={styles.error}>{errorMessage}</span> : null}
      </div>
      <div className={styles.roll} aria-label={`${trackName} Piano Roll`}>
        <div className={styles.keyboard} aria-hidden="true">
          {Array.from({ length: 13 }, (_, index) => HIGHEST_VISIBLE_PITCH - index * 4).map(pitch => (
            <span key={pitch}>{pitch}</span>
          ))}
        </div>
        <div className={styles.grid}>
          {region?.notes.map(note => {
            const visiblePitch = clamp(note.pitch, LOWEST_VISIBLE_PITCH, HIGHEST_VISIBLE_PITCH);
            return (
              <button
                key={note.id}
                type="button"
                aria-label={`${trackName} note ${note.pitch}`}
                aria-pressed={selectedNoteId === note.id}
                className={selectedNoteId === note.id ? styles.noteSelected : styles.note}
                data-note-id={note.id}
                onClick={() => setSelectedNoteId(note.id)}
                onKeyDown={event => handleNoteKeyDown(event, note)}
                style={{
                  height: `${100 / VISIBLE_PITCH_COUNT}%`,
                  left: `${(note.startOffsetSeconds / rollDuration) * 100}%`,
                  top: `${((HIGHEST_VISIBLE_PITCH - visiblePitch) / VISIBLE_PITCH_COUNT) * 100}%`,
                  width: `${Math.max(0.8, (note.durationSeconds / rollDuration) * 100)}%`,
                }}
                title={`Pitch ${note.pitch} · Velocity ${note.velocity}`}
              />
            );
          })}
        </div>
      </div>
    </Fragment>
  );
}
