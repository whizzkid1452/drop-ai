import { useRef, useState, type ChangeEvent } from 'react';
import { useCommandExecutor, useSession } from '@/layers/apps/web/context/LayerContext';
import { executeTrackRegionImport } from '@/layers/apps/web/hooks/track-region-import-command';
import { convertFileToAudioFile } from '@/utils/audio/convert-file-to-audio-file';
import {
  ACCEPTED_AUDIO_TYPES,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MB,
} from '@/layers/apps/web/components/common/FileDrop/constants/audioConstants';
import * as styles from './TrackRegionImportControl.css.ts';

interface TrackRegionImportControlProps {
  trackId: string;
  disabled?: boolean;
  onPendingChange?: (isPending: boolean) => void;
}

function getFileValidationMessage(file: File): string | null {
  if (!ACCEPTED_AUDIO_TYPES.some(acceptedType => acceptedType === file.type)) {
    return '지원하지 않는 오디오 형식입니다.';
  }

  return file.size > MAX_FILE_SIZE ? `파일 크기는 ${MAX_FILE_SIZE_MB}MB 이하여야 합니다.` : null;
}

export function TrackRegionImportControl({
  trackId,
  disabled = false,
  onPendingChange,
}: TrackRegionImportControlProps) {
  const commandExecutor = useCommandExecutor();
  const currentTime = useSession(state => state.currentTime);
  const addAudioFile = useSession(state => state.addAudioFile);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, setIsPending] = useState(false);
  const isDisabled = disabled || isPending;

  const updatePending = (nextIsPending: boolean) => {
    setIsPending(nextIsPending);
    onPendingChange?.(nextIsPending);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || isDisabled) {
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
      await executeTrackRegionImport({
        file,
        trackId,
        startTime: currentTime,
        createRegionId: () => crypto.randomUUID(),
        convertAudioFile: convertFileToAudioFile,
        executeCommand: command => commandExecutor.execute(command),
        registerAudioFile: addAudioFile,
        releaseAudioUrl: url => URL.revokeObjectURL(url),
        notifyFailure: message => window.alert(message),
      });
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
        aria-label="Region 오디오 파일 선택"
        tabIndex={-1}
        disabled={isDisabled}
        onChange={event => void handleFileChange(event)}
      />
      <button
        className={styles.button}
        type="button"
        aria-label="Region 오디오 파일 추가"
        aria-busy={isPending}
        disabled={isDisabled}
        title="현재 재생 위치에 오디오 Region을 추가합니다."
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? 'Region 추가 중…' : 'Region 추가'}
      </button>
    </>
  );
}
