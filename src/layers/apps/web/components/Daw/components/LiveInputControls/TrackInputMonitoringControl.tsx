import { useState } from 'react';
import {
  useAudioRuntimeCapabilities,
  useCommandExecutor,
  useLiveInputRuntimeState,
} from '@/layers/apps/web/context/layer-hooks';
import { describeAudioRuntimeFeatureCapability } from '@/layers/apps/web/utils/audio-runtime-capability-labels';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { AudioRuntimeFeature } from '@/layers/shared/utils/audio-runtime-capabilities';
import * as styles from './LiveInputControls.css.ts';

export function TrackInputMonitoringControl({
  trackId,
  trackName,
}: {
  readonly trackId: string;
  readonly trackName: string;
}) {
  const capabilities = useAudioRuntimeCapabilities();
  const commandExecutor = useCommandExecutor();
  const liveInputState = useLiveInputRuntimeState();
  const [isPending, setIsPending] = useState(false);
  const capability = capabilities.features[AudioRuntimeFeature.LIVE_INPUT];
  const isAvailable = capability.status === 'available';
  const isMonitoring = liveInputState.monitoringTrackId === trackId;
  const disabledReason = !isAvailable
    ? describeAudioRuntimeFeatureCapability(capability)
    : liveInputState.deviceId === null
      ? '입력 장치를 먼저 연결해야 합니다.'
      : undefined;

  const handleMonitoring = async () => {
    if (disabledReason || isPending) {
      return;
    }
    setIsPending(true);
    try {
      await commandExecutor.execute({
        enabled: !isMonitoring,
        trackId,
        type: AudioCommandType.SET_INPUT_MONITORING,
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      aria-label={`${trackName} 입력 모니터링`}
      aria-pressed={isMonitoring}
      className={`${styles.monitoringButton} ${isMonitoring ? styles.monitoringActive : ''}`}
      disabled={Boolean(disabledReason) || isPending}
      onClick={() => void handleMonitoring()}
      title={disabledReason ?? '입력 모니터링'}
      type="button"
    >
      I
    </button>
  );
}
