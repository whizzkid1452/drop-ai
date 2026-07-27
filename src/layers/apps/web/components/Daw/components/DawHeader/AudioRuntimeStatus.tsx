import { useId } from 'react';
import { useAudioRuntimeCapabilities } from '@/layers/apps/web/context/layer-hooks';
import { AudioRuntimeBlocker, type AudioRuntimeCapabilities } from '@/layers/shared/utils/audio-runtime-capabilities';
import * as styles from './AudioRuntimeStatus.css';

type AudioRuntimeLevel = 'full' | 'limited' | 'standard';

const blockerLabels: Record<AudioRuntimeBlocker, string> = {
  [AudioRuntimeBlocker.AUDIO_WORKLET_API_UNAVAILABLE]: 'AudioWorklet API',
  [AudioRuntimeBlocker.GET_USER_MEDIA_API_UNAVAILABLE]: '오디오 입력 요청 API',
  [AudioRuntimeBlocker.MEDIA_DEVICES_API_UNAVAILABLE]: '미디어 장치 API',
  [AudioRuntimeBlocker.CROSS_ORIGIN_ISOLATION_UNAVAILABLE]: '사이트 격리',
  [AudioRuntimeBlocker.INSECURE_CONTEXT]: '보안 연결(HTTPS 또는 localhost)',
  [AudioRuntimeBlocker.SHARED_ARRAY_BUFFER_UNAVAILABLE]: '공유 메모리 API',
  [AudioRuntimeBlocker.WEBASSEMBLY_API_UNAVAILABLE]: 'WebAssembly API',
};

const levelLabels: Record<AudioRuntimeLevel, string> = {
  full: '브라우저 오디오: 고성능 전제조건 충족',
  limited: '브라우저 오디오: 기능 제한',
  standard: '브라우저 오디오: 공유 메모리 제한',
};

const levelStyles: Record<AudioRuntimeLevel, string> = {
  full: styles.full,
  limited: styles.limited,
  standard: styles.standard,
};

function resolveAudioRuntimeLevel(capabilities: AudioRuntimeCapabilities): AudioRuntimeLevel {
  if (
    capabilities.meetsAudioWorkletPreconditions &&
    capabilities.meetsLiveInputPreconditions &&
    capabilities.meetsWasmPreconditions &&
    capabilities.meetsSharedMemoryPreconditions
  ) {
    return 'full';
  }

  if (
    capabilities.meetsAudioWorkletPreconditions &&
    capabilities.meetsLiveInputPreconditions &&
    capabilities.meetsWasmPreconditions
  ) {
    return 'standard';
  }

  return 'limited';
}

function collectBlockerLabels(capabilities: AudioRuntimeCapabilities): string[] {
  const blockers = [
    ...capabilities.blockers.audioWorklet,
    ...capabilities.blockers.liveInput,
    ...capabilities.blockers.wasm,
    ...capabilities.blockers.sharedMemory,
  ];

  return [...new Set(blockers.map(blocker => blockerLabels[blocker]))];
}

function resolveStatusDescription(level: AudioRuntimeLevel, capabilities: AudioRuntimeCapabilities): string {
  if (level === 'full') {
    return 'AudioWorklet, WebAssembly API, 공유 메모리의 정적 전제조건을 충족했습니다. 실제 모듈 실행은 별도 확인이 필요합니다.';
  }

  if (level === 'standard') {
    return 'AudioWorklet과 WebAssembly API 전제조건을 충족했습니다. 공유 메모리 전제조건은 충족하지 못했습니다.';
  }

  return `확인 필요: ${collectBlockerLabels(capabilities).join(', ')}`;
}

export function AudioRuntimeStatus() {
  const capabilities = useAudioRuntimeCapabilities();
  const level = resolveAudioRuntimeLevel(capabilities);
  const descriptionId = useId();
  const description = resolveStatusDescription(level, capabilities);

  return (
    <>
      <span
        aria-describedby={descriptionId}
        aria-label={levelLabels[level]}
        className={`${styles.status} ${levelStyles[level]}`}
        data-level={level}
        role="status"
        title={description}
      >
        {levelLabels[level]}
      </span>
      <span className={styles.visuallyHidden} id={descriptionId}>
        {description}
      </span>
    </>
  );
}
