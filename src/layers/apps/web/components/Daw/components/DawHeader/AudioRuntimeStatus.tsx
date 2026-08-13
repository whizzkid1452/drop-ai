import { useId } from 'react';
import { useAudioRuntimeCapabilities } from '@/layers/apps/web/context/layer-hooks';
import {
  audioRuntimeBlockerLabels,
  audioRuntimeFeatureLabels,
  audioRuntimeFeatureStatusLabels,
  describeAudioRuntimeFeatureCapability,
} from '@/layers/apps/web/utils/audio-runtime-capability-labels';
import type { AudioRuntimeCapabilities } from '@/layers/shared/utils/audio-runtime-capabilities';
import * as styles from './AudioRuntimeStatus.css';

type AudioRuntimeLevel = 'full' | 'limited' | 'standard';

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

  return [...new Set(blockers.map(blocker => audioRuntimeBlockerLabels[blocker]))];
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
  const panelId = useId();
  const description = resolveStatusDescription(level, capabilities);
  const featureEntries = Object.entries(capabilities.features) as Array<
    [
      keyof AudioRuntimeCapabilities['features'],
      AudioRuntimeCapabilities['features'][keyof AudioRuntimeCapabilities['features']],
    ]
  >;

  return (
    <details className={styles.details}>
      <summary aria-controls={panelId} className={styles.summary}>
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
      </summary>
      <span className={styles.visuallyHidden} id={descriptionId}>
        {description}
      </span>
      <div aria-label="오디오 기능 지원 상태" className={styles.capabilityPanel} id={panelId} role="region">
        <strong>오디오 기능 지원 상태</strong>
        <ul className={styles.capabilityList}>
          {featureEntries.map(([feature, capability]) => (
            <li className={styles.capabilityRow} data-feature={feature} key={feature}>
              <span>{audioRuntimeFeatureLabels[feature]}</span>
              <span className={`${styles.capabilityStatus} ${styles[capability.status]}`}>
                {audioRuntimeFeatureStatusLabels[capability.status]}
              </span>
              <span className={styles.capabilityReason}>{describeAudioRuntimeFeatureCapability(capability)}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
