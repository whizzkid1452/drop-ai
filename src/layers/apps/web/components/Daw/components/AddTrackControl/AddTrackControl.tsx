import { useRef, useState, type ChangeEvent } from 'react';
import { useAudioSourceStager, useCommandExecutor } from '@/layers/apps/web/context/layer-hooks';
import { stageWebAudioSource } from '@/layers/apps/web/hooks/stage-web-audio-source';
import { convertFileToAudioFile } from '@/utils/audio/convert-file-to-audio-file';
import {
  ACCEPTED_AUDIO_TYPES,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MB,
} from '@/layers/apps/web/components/common/FileDrop/constants/audioConstants';
import { executeAudioFileImport } from '@/layers/apps/web/components/common/FileDrop/execute-audio-file-import';
import * as styles from './AddTrackControl.css.ts';

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
  const audioSourceStager = useAudioSourceStager();
  const inputRef = useRef<HTMLInputElement>(null);
  const isPendingRef = useRef(false);
  const [isPending, setIsPending] = useState(false);

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
    </>
  );
}
