import { useEffect, useState } from 'react';
import {
  useAudioRuntimeCapabilities,
  useCommandExecutor,
  useLiveInputQuery,
  useLiveInputRuntimeState,
} from '@/layers/apps/web/context/layer-hooks';
import { describeAudioRuntimeFeatureCapability } from '@/layers/apps/web/utils/audio-runtime-capability-labels';
import type { LiveAudioInputDevice } from '@/layers/shared/types/live-input';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { AudioRuntimeFeature } from '@/layers/shared/utils/audio-runtime-capabilities';
import { AudioLevelMeter } from '../AudioLevelMeter/AudioLevelMeter';
import * as styles from './LiveInputControls.css.ts';

export function InputDeviceControl() {
  const capabilities = useAudioRuntimeCapabilities();
  const commandExecutor = useCommandExecutor();
  const liveInputQuery = useLiveInputQuery();
  const liveInputState = useLiveInputRuntimeState();
  const [devices, setDevices] = useState<readonly LiveAudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(liveInputState.deviceId ?? '');
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const capability = capabilities.features[AudioRuntimeFeature.LIVE_INPUT];
  const isAvailable = capability.status === 'available';
  const unavailableReason = describeAudioRuntimeFeatureCapability(capability);

  useEffect(() => {
    setSelectedDeviceId(liveInputState.deviceId ?? '');
  }, [liveInputState.deviceId]);

  useEffect(() => {
    let isActive = true;
    if (!isAvailable) {
      return () => {
        isActive = false;
      };
    }

    void liveInputQuery
      .listDevices()
      .then(nextDevices => {
        if (isActive) {
          setDevices(nextDevices);
        }
      })
      .catch(error => {
        if (isActive) {
          setErrorMessage(error instanceof Error ? error.message : '입력 장치 목록을 읽지 못했습니다.');
        }
      });
    return () => {
      isActive = false;
    };
  }, [isAvailable, liveInputQuery]);

  const handleConnect = async () => {
    if (!isAvailable || isPending) {
      return;
    }
    setIsPending(true);
    setErrorMessage(null);
    try {
      await commandExecutor.execute({
        deviceId: selectedDeviceId || null,
        type: AudioCommandType.SET_AUDIO_INPUT_DEVICE,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '입력 장치에 연결하지 못했습니다.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div
      aria-label="오디오 입력"
      className={styles.control}
      role="group"
      title={isAvailable ? undefined : unavailableReason}
    >
      <select
        aria-label="입력 장치"
        className={styles.select}
        disabled={!isAvailable || isPending}
        value={selectedDeviceId}
        onChange={event => setSelectedDeviceId(event.target.value)}
      >
        <option value="">기본 입력</option>
        {devices.map((device, index) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `입력 장치 ${index + 1}`}
          </option>
        ))}
      </select>
      <button
        aria-label="입력 장치 연결"
        className={styles.button}
        disabled={!isAvailable || isPending}
        onClick={() => void handleConnect()}
        type="button"
      >
        {isPending ? '연결 중' : '연결'}
      </button>
      <AudioLevelMeter label="Input" target={{ kind: 'input' }} />
      {errorMessage ? (
        <span className={styles.error} role="alert">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
