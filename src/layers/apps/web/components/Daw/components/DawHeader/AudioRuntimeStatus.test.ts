// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AudioRuntimeBlocker,
  CURRENT_AUDIO_RUNTIME_FEATURE_SUPPORT,
  resolveAudioRuntimeCapabilities,
  type AudioRuntimeCapabilities,
} from '@/layers/shared/utils/audio-runtime-capabilities';
import { AudioRuntimeStatus } from './AudioRuntimeStatus';

const layerMocks = vi.hoisted((): { capabilities: AudioRuntimeCapabilities } => ({
  capabilities: {
    blockers: { audioWorklet: [], liveInput: [], sharedMemory: [], wasm: [] },
    features: {} as AudioRuntimeCapabilities['features'],
    meetsAudioWorkletPreconditions: true,
    meetsLiveInputPreconditions: true,
    meetsSharedMemoryPreconditions: true,
    meetsWasmPreconditions: true,
  },
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAudioRuntimeCapabilities: () => layerMocks.capabilities,
}));

vi.mock('./AudioRuntimeStatus.css.ts', () => ({
  available: 'available',
  blocked: 'blocked',
  capabilityList: 'capabilityList',
  capabilityPanel: 'capabilityPanel',
  capabilityReason: 'capabilityReason',
  capabilityRow: 'capabilityRow',
  capabilityStatus: 'capabilityStatus',
  details: 'details',
  full: 'full',
  limited: 'limited',
  standard: 'standard',
  status: 'status',
  summary: 'summary',
  unsupported: 'unsupported',
  visuallyHidden: 'visually-hidden',
}));

const fullEnvironment = {
  crossOriginIsolated: true,
  hasAudioWorklet: true,
  hasGetUserMedia: true,
  hasMediaDevices: true,
  hasSharedArrayBuffer: true,
  hasWebAssembly: true,
  isSecureContext: true,
};

function createFullCapabilities(): AudioRuntimeCapabilities {
  return resolveAudioRuntimeCapabilities(fullEnvironment, CURRENT_AUDIO_RUNTIME_FEATURE_SUPPORT);
}

layerMocks.capabilities = createFullCapabilities();

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderStatus(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);

  act(() => root.render(createElement(AudioRuntimeStatus)));

  const status = host.querySelector<HTMLElement>('[role="status"]');
  if (!status) {
    throw new Error('브라우저 오디오 상태를 찾지 못했습니다.');
  }

  return status;
}

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
  layerMocks.capabilities = createFullCapabilities();
});

describe('AudioRuntimeStatus', () => {
  it('기능별 지원 상태와 차단 원인을 상세 패널에 표시한다', () => {
    layerMocks.capabilities = resolveAudioRuntimeCapabilities(
      { ...fullEnvironment, hasGetUserMedia: false },
      CURRENT_AUDIO_RUNTIME_FEATURE_SUPPORT
    );

    renderStatus();

    const panel = document.querySelector<HTMLElement>('[aria-label="오디오 기능 지원 상태"]');
    const liveInput = document.querySelector<HTMLElement>('[data-feature="liveInput"]');
    const metering = document.querySelector<HTMLElement>('[data-feature="metering"]');
    const playback = document.querySelector<HTMLElement>('[data-feature="timelinePlayback"]');

    expect(panel).not.toBeNull();
    expect(liveInput?.textContent).toContain('환경 차단');
    expect(liveInput?.textContent).toContain('오디오 입력 요청 API');
    expect(metering?.textContent).toContain('사용 가능');
    expect(playback?.textContent).toContain('사용 가능');
  });

  it('세 전제조건을 충족하면 판정 범위를 명시하고 상세 설명을 연결한다', () => {
    const status = renderStatus();
    const descriptionId = status.getAttribute('aria-describedby');

    expect(status.textContent).toBe('브라우저 오디오: 고성능 전제조건 충족');
    expect(status.getAttribute('aria-label')).toBe('브라우저 오디오: 고성능 전제조건 충족');
    expect(descriptionId).not.toBeNull();
    expect(document.getElementById(descriptionId ?? '')?.textContent).toContain('실제 모듈 실행은 별도 확인');
    expect(status.dataset.level).toBe('full');
  });

  it('격리가 없으면 AudioWorklet과 WASM을 막지 않고 공유 메모리 제한을 표시한다', () => {
    layerMocks.capabilities = {
      blockers: {
        audioWorklet: [],
        liveInput: [],
        sharedMemory: [
          AudioRuntimeBlocker.CROSS_ORIGIN_ISOLATION_UNAVAILABLE,
          AudioRuntimeBlocker.SHARED_ARRAY_BUFFER_UNAVAILABLE,
        ],
        wasm: [],
      },
      features: {} as AudioRuntimeCapabilities['features'],
      meetsAudioWorkletPreconditions: true,
      meetsLiveInputPreconditions: true,
      meetsSharedMemoryPreconditions: false,
      meetsWasmPreconditions: true,
    };

    const status = renderStatus();

    expect(status.textContent).toBe('브라우저 오디오: 공유 메모리 제한');
    expect(status.title).toContain('공유 메모리');
    expect(status.dataset.level).toBe('standard');
  });

  it('AudioWorklet 또는 WASM 전제조건이 없으면 제한 상태를 표시한다', () => {
    layerMocks.capabilities = {
      blockers: {
        audioWorklet: [AudioRuntimeBlocker.INSECURE_CONTEXT, AudioRuntimeBlocker.AUDIO_WORKLET_API_UNAVAILABLE],
        liveInput: [AudioRuntimeBlocker.INSECURE_CONTEXT],
        sharedMemory: [AudioRuntimeBlocker.INSECURE_CONTEXT],
        wasm: [AudioRuntimeBlocker.WEBASSEMBLY_API_UNAVAILABLE],
      },
      features: {} as AudioRuntimeCapabilities['features'],
      meetsAudioWorkletPreconditions: false,
      meetsLiveInputPreconditions: false,
      meetsSharedMemoryPreconditions: false,
      meetsWasmPreconditions: false,
    };

    const status = renderStatus();

    expect(status.textContent).toBe('브라우저 오디오: 기능 제한');
    expect(status.title).toContain('보안 연결');
    expect(status.title).toContain('WebAssembly API');
    expect(status.dataset.level).toBe('limited');
  });

  it('실시간 입력 API가 없으면 제한 상태와 차단 사유를 표시한다', () => {
    layerMocks.capabilities = {
      blockers: {
        audioWorklet: [],
        liveInput: [AudioRuntimeBlocker.MEDIA_DEVICES_API_UNAVAILABLE],
        sharedMemory: [],
        wasm: [],
      },
      features: {} as AudioRuntimeCapabilities['features'],
      meetsAudioWorkletPreconditions: true,
      meetsLiveInputPreconditions: false,
      meetsSharedMemoryPreconditions: true,
      meetsWasmPreconditions: true,
    };

    const status = renderStatus();

    expect(status.dataset.level).toBe('limited');
    expect(status.title).toContain('미디어 장치 API');
  });
});
