import { useState, type ChangeEvent } from 'react';
import { useCommandExecutor, useMidiInput, useMidiRecordingRuntimeState } from '@/layers/apps/web/context/layer-hooks';
import type { MidiInputDevice } from '@/layers/midi-input/i-midi-input';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import type { MidiTrackState } from '@/layers/shared/types/midi-state';
import * as styles from './MidiRecordingControls.css.ts';

const DEFAULT_QUANTIZE_STEP_SECONDS = 0.25;
const MIDI_CHANNELS = Array.from({ length: 16 }, (_, index) => index + 1);

interface MidiRecordingControlsProps {
  readonly midi: MidiTrackState;
  readonly regionId: string | null;
  readonly trackId: string;
  readonly trackName: string;
}

export function MidiRecordingControls({ midi, regionId, trackId, trackName }: MidiRecordingControlsProps) {
  const commandExecutor = useCommandExecutor();
  const midiInput = useMidiInput();
  const recordingState = useMidiRecordingRuntimeState();
  const [devices, setDevices] = useState<readonly MidiInputDevice[]>([]);
  const [inputId, setInputId] = useState<string | null>(null);
  const [inputChannel, setInputChannel] = useState<number | null>(null);
  const [quantizeStepSeconds, setQuantizeStepSeconds] = useState(DEFAULT_QUANTIZE_STEP_SECONDS);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeRegion = midi.regions.find(region => region.id === regionId) ?? null;
  const noteIds = activeRegion?.notes.map(note => note.id) ?? [];
  const isThisTrackRecording = recordingState.isRecording && recordingState.trackId === trackId;

  const runCommand = async (command: Parameters<typeof commandExecutor.execute>[0]) => {
    setErrorMessage(null);
    setIsPending(true);
    try {
      await commandExecutor.execute(command);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPending(false);
    }
  };

  const connectInput = async () => {
    setErrorMessage(null);
    setIsPending(true);
    try {
      const connectedDevices = await midiInput.connect();
      setDevices(connectedDevices);
      setInputId(currentInputId => currentInputId ?? connectedDevices[0]?.id ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPending(false);
    }
  };

  const handleInputChannelChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setInputChannel(event.target.value === '' ? null : Number(event.target.value));
  };

  return (
    <section className={styles.controls} aria-label={`${trackName} MIDI 녹음 및 편집`}>
      <button
        aria-label={`${trackName} MIDI 입력 연결`}
        className={styles.button}
        disabled={isPending || recordingState.isRecording}
        onClick={() => void connectInput()}
        type="button"
      >
        INPUT
      </button>
      <label className={styles.field}>
        DEVICE
        <select
          aria-label={`${trackName} MIDI 입력 장치`}
          className={styles.select}
          disabled={isPending || recordingState.isRecording}
          onChange={event => setInputId(event.target.value || null)}
          value={inputId ?? ''}
        >
          <option value="">ALL</option>
          {devices.map(device => (
            <option key={device.id} value={device.id}>
              {device.name ?? device.id}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        CH
        <select
          aria-label={`${trackName} MIDI 입력 채널`}
          className={styles.select}
          disabled={isPending || recordingState.isRecording}
          onChange={handleInputChannelChange}
          value={inputChannel ?? ''}
        >
          <option value="">ALL</option>
          {MIDI_CHANNELS.map(channel => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        MODE
        <select
          aria-label={`${trackName} MIDI 녹음 모드`}
          className={styles.select}
          disabled={isPending || recordingState.isRecording}
          onChange={event =>
            void runCommand({
              recordMode: event.target.value as MidiTrackState['recordMode'],
              trackId,
              type: AudioCommandType.SET_MIDI_RECORD_MODE,
            })
          }
          value={midi.recordMode}
        >
          <option value="replace">REPLACE</option>
          <option value="overdub">OVERDUB</option>
        </select>
      </label>
      {isThisTrackRecording ? (
        <>
          <button
            aria-label={`${trackName} MIDI 녹음 종료`}
            className={styles.buttonActive}
            disabled={isPending}
            onClick={() => void runCommand({ trackId, type: AudioCommandType.STOP_MIDI_RECORDING })}
            type="button"
          >
            STOP
          </button>
          <button
            aria-label={`${trackName} MIDI 녹음 취소`}
            className={styles.button}
            disabled={isPending}
            onClick={() => void runCommand({ trackId, type: AudioCommandType.CANCEL_MIDI_RECORDING })}
            type="button"
          >
            CANCEL
          </button>
        </>
      ) : (
        <button
          aria-label={`${trackName} MIDI 녹음 시작`}
          className={styles.button}
          disabled={isPending || recordingState.isRecording}
          onClick={() =>
            void runCommand({ inputChannel, inputId, trackId, type: AudioCommandType.START_MIDI_RECORDING })
          }
          type="button"
        >
          REC
        </button>
      )}
      <label className={styles.field}>
        GRID
        <select
          aria-label={`${trackName} MIDI Quantize 간격`}
          className={styles.select}
          disabled={isPending}
          onChange={event => setQuantizeStepSeconds(Number(event.target.value))}
          value={quantizeStepSeconds}
        >
          <option value={1}>1 s</option>
          <option value={0.5}>1/2 s</option>
          <option value={0.25}>1/4 s</option>
          <option value={0.125}>1/8 s</option>
        </select>
      </label>
      <button
        aria-label={`${trackName} MIDI Quantize`}
        className={styles.button}
        disabled={isPending || !activeRegion || noteIds.length === 0}
        onClick={() => {
          if (activeRegion) {
            void runCommand({
              noteIds,
              regionId: activeRegion.id,
              stepSeconds: quantizeStepSeconds,
              trackId,
              type: AudioCommandType.QUANTIZE_MIDI_NOTES,
            });
          }
        }}
        type="button"
      >
        Q
      </button>
      {[-12, 12].map(semitones => (
        <button
          key={semitones}
          aria-label={`${trackName} MIDI ${semitones > 0 ? '+' : ''}${semitones} transpose`}
          className={styles.button}
          disabled={isPending || !activeRegion || noteIds.length === 0}
          onClick={() => {
            if (activeRegion) {
              void runCommand({
                noteIds,
                regionId: activeRegion.id,
                semitones,
                trackId,
                type: AudioCommandType.TRANSPOSE_MIDI_NOTES,
              });
            }
          }}
          type="button"
        >
          {semitones > 0 ? '+' : ''}
          {semitones}
        </button>
      ))}
      <button
        aria-label={`${trackName} MIDI Panic`}
        className={styles.button}
        disabled={isPending}
        onClick={() => void runCommand({ type: AudioCommandType.MIDI_PANIC })}
        type="button"
      >
        PANIC
      </button>
      <span className={styles.status} aria-live="polite">
        {isThisTrackRecording
          ? `REC · ${recordingState.capturedEventCount} EVENTS`
          : recordingState.isRecording
            ? 'OTHER TRACK RECORDING'
            : `${activeRegion?.notes.length ?? 0} NOTES · ${activeRegion?.controlLanes.length ?? 0} CTRL`}
      </span>
      {errorMessage ? <span className={styles.error}>{errorMessage}</span> : null}
    </section>
  );
}
