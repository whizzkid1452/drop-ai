import { useState } from 'react';
import {
  useAudioRuntimeCapabilities,
  useCommandExecutor,
  useRecordingRuntimeState,
} from '@/layers/apps/web/context/layer-hooks';
import { describeAudioRuntimeFeatureCapability } from '@/layers/apps/web/utils/audio-runtime-capability-labels';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { AudioRuntimeFeature } from '@/layers/shared/utils/audio-runtime-capabilities';
import * as styles from '../Track.css.ts';

interface TrackRecordArmControlProps {
  readonly trackId: string;
  readonly trackName: string;
}

export function TrackRecordArmControl({ trackId, trackName }: TrackRecordArmControlProps) {
  const commandExecutor = useCommandExecutor();
  const capability = useAudioRuntimeCapabilities().features[AudioRuntimeFeature.LINEAR_RECORDING];
  const recordingState = useRecordingRuntimeState();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isArmed = recordingState.armedTrackIds.includes(trackId);
  const isRecordingIdle = recordingState.phase === 'idle';
  const unavailableReason =
    capability.status === 'available' ? undefined : describeAudioRuntimeFeatureCapability(capability);

  const handleArmChange = async () => {
    if (!isRecordingIdle || isPending || unavailableReason) {
      return;
    }

    setIsPending(true);
    try {
      await commandExecutor.execute({
        armed: !isArmed,
        trackId,
        type: AudioCommandType.SET_TRACK_RECORD_ARM,
      });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      aria-label={`${trackName} 녹음 arm`}
      aria-pressed={isArmed}
      className={`${styles.trackActionButton} ${isArmed ? styles.recordButtonActive : ''}`}
      disabled={!isRecordingIdle || isPending || Boolean(unavailableReason)}
      onClick={() => void handleArmChange()}
      title={errorMessage ?? unavailableReason ?? '녹음 arm'}
      type="button"
    >
      R
    </button>
  );
}
