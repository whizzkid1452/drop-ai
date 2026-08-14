import { useRef, useState, type ChangeEvent } from 'react';
import {
  useAudioRuntimeCapabilities,
  useAudioSourceStager,
  useCommandExecutor,
} from '@/layers/apps/web/context/layer-hooks';
import { stageWebAudioSource } from '@/layers/apps/web/hooks/stage-web-audio-source';
import { convertFileToAudioFile } from '@/utils/audio/convert-file-to-audio-file';
import {
  ACCEPTED_AUDIO_TYPES,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MB,
} from '@/layers/apps/web/components/common/FileDrop/constants/audioConstants';
import { executeAudioFileImport } from '@/layers/apps/web/components/common/FileDrop/execute-audio-file-import';
import * as styles from './AddTrackControl.css.ts';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { AudioRuntimeFeature } from '@/layers/shared/utils/audio-runtime-capabilities';
import { describeAudioRuntimeFeatureCapability } from '@/layers/apps/web/utils/audio-runtime-capability-labels';
import { executeMidiFileImport } from '@/layers/apps/web/midi/execute-midi-file-import';

const ACCEPTED_MIDI_FILE_TYPES = '.mid,.midi,audio/midi,audio/x-midi';

function getFileValidationMessage(file: File): string | null {
  if (!ACCEPTED_AUDIO_TYPES.some(acceptedType => acceptedType === file.type)) {
    return '지원하지 않는 오디오 형식입니다.';
  }

  return file.size > MAX_FILE_SIZE ? `파일 크기는 ${MAX_FILE_SIZE_MB}MB 이하여야 합니다.` : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AddTrackControl() {
  const commandExecutor = useCommandExecutor();
  const midiCapability = useAudioRuntimeCapabilities().features[AudioRuntimeFeature.MIDI];
  const audioSourceStager = useAudioSourceStager();
  const inputRef = useRef<HTMLInputElement>(null);
  const midiInputRef = useRef<HTMLInputElement>(null);
  const isPendingRef = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [isMidiPending, setIsMidiPending] = useState(false);

  const updatePending = (nextIsPending: boolean) => {
    isPendingRef.current = nextIsPending;
    setIsPending(nextIsPending);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || isPendingRef.current) {
      input.value = '';
      return;
    }

    const validationMessage = getFileValidationMessage(file);
    if (validationMessage !== null) {
      window.alert(validationMessage);
      input.value = '';
      return;
    }

    updatePending(true);
    try {
      const audioFileMetadata = await convertFileToAudioFile(file);
      if (audioFileMetadata === null) {
        window.alert('오디오 파일을 읽지 못했습니다.');
        return;
      }

      const trackId = crypto.randomUUID();
      const regionId = crypto.randomUUID();
      const stagedSource = stageWebAudioSource({ audioSourceStager, audioFileMetadata });
      await executeAudioFileImport({
        commandExecutor,
        audioSourceStager,
        stagedSource,
        trackId,
        regionId,
      });
    } catch (error) {
      console.error(error);
      window.alert(`새 Track을 추가하지 못했습니다: ${getErrorMessage(error)}`);
    } finally {
      input.value = '';
      updatePending(false);
    }
  };

  const handleAddMidiTrack = async () => {
    if (isMidiPending || midiCapability.status !== 'available') {
      return;
    }
    setIsMidiPending(true);
    try {
      await commandExecutor.execute({ trackId: crypto.randomUUID(), type: AudioCommandType.ADD_MIDI_TRACK });
    } catch (error) {
      window.alert(`MIDI Track을 추가하지 못했습니다: ${getErrorMessage(error)}`);
    } finally {
      setIsMidiPending(false);
    }
  };

  const handleMidiFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || isMidiPending || midiCapability.status !== 'available') {
      input.value = '';
      return;
    }
    setIsMidiPending(true);
    try {
      await executeMidiFileImport({ commandExecutor, createId: () => crypto.randomUUID(), file });
    } catch (error) {
      window.alert(`MIDI 파일을 가져오지 못했습니다: ${getErrorMessage(error)}`);
    } finally {
      input.value = '';
      setIsMidiPending(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        className={styles.input}
        type="file"
        accept={ACCEPTED_AUDIO_TYPES.join(',')}
        aria-label="새 Track 오디오 파일 선택"
        tabIndex={-1}
        disabled={isPending}
        onChange={event => void handleFileChange(event)}
      />
      <input
        ref={midiInputRef}
        className={styles.input}
        type="file"
        accept={ACCEPTED_MIDI_FILE_TYPES}
        aria-label="MIDI 파일 선택"
        tabIndex={-1}
        disabled={isMidiPending || midiCapability.status !== 'available'}
        onChange={event => void handleMidiFileChange(event)}
      />
      <button
        className={styles.button}
        type="button"
        aria-label="새 오디오 Track 추가"
        aria-busy={isPending}
        disabled={isPending}
        title="오디오 파일로 새 Track을 추가합니다."
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? 'ADDING…' : '+ TRACK'}
      </button>
      <button
        className={styles.button}
        type="button"
        aria-label="빈 MIDI Track 추가"
        aria-busy={isMidiPending}
        disabled={isMidiPending || midiCapability.status !== 'available'}
        title={
          midiCapability.status === 'available'
            ? '내장 Instrument를 사용하는 MIDI Track을 추가합니다.'
            : describeAudioRuntimeFeatureCapability(midiCapability)
        }
        onClick={() => void handleAddMidiTrack()}
      >
        {isMidiPending ? 'ADDING…' : '+ MIDI'}
      </button>
      <button
        className={styles.button}
        type="button"
        aria-label="MIDI 파일 가져오기"
        aria-busy={isMidiPending}
        disabled={isMidiPending || midiCapability.status !== 'available'}
        title={
          midiCapability.status === 'available'
            ? 'Standard MIDI File을 새 MIDI Track으로 가져옵니다.'
            : describeAudioRuntimeFeatureCapability(midiCapability)
        }
        onClick={() => midiInputRef.current?.click()}
      >
        MIDI FILE
      </button>
    </>
  );
}
