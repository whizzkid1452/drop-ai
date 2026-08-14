import { useEffect, useId, useState } from 'react';
import {
  useAudioRuntimeCapabilities,
  useCommandExecutor,
  useRuntimeDiagnosticsQuery,
  useRuntimeDiagnosticsState,
} from '@/layers/apps/web/context/layer-hooks';
import {
  audioRuntimeBlockerLabels,
  audioRuntimeFeatureLabels,
  audioRuntimeFeatureStatusLabels,
  describeAudioRuntimeFeatureCapability,
} from '@/layers/apps/web/utils/audio-runtime-capability-labels';
import type { AudioRuntimeCapabilities } from '@/layers/shared/utils/audio-runtime-capabilities';
import { RUNTIME_DIAGNOSTIC_BUDGETS } from '@/layers/shared/types/runtime-diagnostics';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
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

function formatStorageUsage(usageRatio: number | null): string {
  return usageRatio === null ? '조회 불가' : `${(usageRatio * 100).toFixed(1)}%`;
}

function formatRuntimeRatio(ratio: number | null): string {
  return ratio === null ? '측정 미지원' : `${(ratio * 100).toFixed(1)}%`;
}

export function AudioRuntimeStatus() {
  const capabilities = useAudioRuntimeCapabilities();
  const commandExecutor = useCommandExecutor();
  const runtimeDiagnostics = useRuntimeDiagnosticsQuery();
  const runtimeDiagnosticsState = useRuntimeDiagnosticsState();
  const [resumeError, setResumeError] = useState<string | null>(null);
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

  useEffect(() => {
    const refresh = () => void runtimeDiagnostics.refresh();
    refresh();
    document.addEventListener('visibilitychange', refresh);
    const intervalId = window.setInterval(refresh, RUNTIME_DIAGNOSTIC_BUDGETS.diagnosticsRefreshIntervalMilliseconds);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(intervalId);
    };
  }, [runtimeDiagnostics]);

  const resumeAudioRuntime = async () => {
    setResumeError(null);
    try {
      await commandExecutor.execute({ type: AudioCommandType.RESUME_AUDIO_RUNTIME });
      await runtimeDiagnostics.refresh();
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : String(error));
    }
  };

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
        <section aria-label="Runtime 안정성 진단" className={styles.diagnosticsPanel}>
          <strong>Runtime 안정성 진단</strong>
          <dl className={styles.diagnosticsList}>
            <div data-diagnostic="audio-context">
              <dt>AudioContext</dt>
              <dd data-status={runtimeDiagnosticsState.audioContextState}>
                {runtimeDiagnosticsState.audioContextState}
              </dd>
            </div>
            <div data-diagnostic="storage">
              <dt>저장소</dt>
              <dd data-status={runtimeDiagnosticsState.storage.status}>
                {formatStorageUsage(runtimeDiagnosticsState.storage.usageRatio)}
              </dd>
            </div>
            <div data-diagnostic="visibility">
              <dt>탭 상태</dt>
              <dd>{runtimeDiagnosticsState.visibilityState}</dd>
            </div>
            <div data-diagnostic="cleanup">
              <dt>정리 대기</dt>
              <dd data-status={runtimeDiagnosticsState.pendingCleanupResourceCount === 0 ? 'available' : 'warning'}>
                {runtimeDiagnosticsState.pendingCleanupResourceCount}
              </dd>
            </div>
            <div data-diagnostic="dsp-load">
              <dt>DSP load</dt>
              <dd
                data-status={
                  runtimeDiagnosticsState.dspLoadRatio === null
                    ? 'unavailable'
                    : runtimeDiagnosticsState.dspLoadRatio <= RUNTIME_DIAGNOSTIC_BUDGETS.maximumDspLoadRatio
                      ? 'available'
                      : 'warning'
                }
              >
                {formatRuntimeRatio(runtimeDiagnosticsState.dspLoadRatio)}
              </dd>
            </div>
            <div data-diagnostic="offline-render">
              <dt>최근 offline render</dt>
              <dd
                data-status={
                  runtimeDiagnosticsState.lastOfflineRenderRealtimeRatio === null
                    ? 'unavailable'
                    : runtimeDiagnosticsState.lastOfflineRenderRealtimeRatio <=
                        RUNTIME_DIAGNOSTIC_BUDGETS.maximumOfflineRenderRealtimeRatio
                      ? 'available'
                      : 'warning'
                }
              >
                {formatRuntimeRatio(runtimeDiagnosticsState.lastOfflineRenderRealtimeRatio)} realtime
              </dd>
            </div>
          </dl>
          {runtimeDiagnosticsState.audioContextState !== 'running' ? (
            <button onClick={() => void resumeAudioRuntime()} type="button">
              오디오 재개
            </button>
          ) : null}
          {runtimeDiagnosticsState.storage.status === 'critical' ? (
            <p className={styles.diagnosticsWarning} role="alert">
              저장소 사용량이 95% 이상입니다. 녹음 전에 미사용 Source를 정리해 주세요.
            </p>
          ) : null}
          {runtimeDiagnosticsState.pendingCleanupResourceCount > 0 ? (
            <p className={styles.diagnosticsWarning}>
              정리에 실패한 오디오 리소스가 있습니다. 오디오 재개로 정리를 다시 시도할 수 있습니다.
            </p>
          ) : null}
          {resumeError ? (
            <p className={styles.diagnosticsError} role="alert">
              {resumeError}
            </p>
          ) : null}
        </section>
      </div>
    </details>
  );
}
