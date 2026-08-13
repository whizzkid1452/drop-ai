import {
  AudioRuntimeBlocker,
  AudioRuntimeFeature,
  type AudioRuntimeFeatureCapability,
} from '@/layers/shared/utils/audio-runtime-capabilities';

export const audioRuntimeFeatureLabels: Readonly<Record<AudioRuntimeFeature, string>> = {
  [AudioRuntimeFeature.ADVANCED_EXPORT]: '고급 Export',
  [AudioRuntimeFeature.AUTOMATION]: 'Automation',
  [AudioRuntimeFeature.BUILT_IN_PLUGINS]: '내장 Plugin',
  [AudioRuntimeFeature.LINEAR_RECORDING]: '선형 녹음',
  [AudioRuntimeFeature.LIVE_INPUT]: '실시간 오디오 입력',
  [AudioRuntimeFeature.LIVE_LOOP]: '라이브 Loop',
  [AudioRuntimeFeature.METERING]: 'Meter',
  [AudioRuntimeFeature.MIDI]: 'MIDI Track',
  [AudioRuntimeFeature.PROJECT_EXPORT]: '프로젝트 WAV Export',
  [AudioRuntimeFeature.REGION_PROCESSING]: 'Region 처리',
  [AudioRuntimeFeature.ROUTING]: 'Routing',
  [AudioRuntimeFeature.TEMPO_LOOP_METRONOME]: 'Tempo·Loop·Metronome',
  [AudioRuntimeFeature.TIMELINE_PLAYBACK]: 'Timeline 재생',
};

export const audioRuntimeBlockerLabels: Readonly<Record<AudioRuntimeBlocker, string>> = {
  [AudioRuntimeBlocker.AUDIO_WORKLET_API_UNAVAILABLE]: 'AudioWorklet API 없음',
  [AudioRuntimeBlocker.GET_USER_MEDIA_API_UNAVAILABLE]: '오디오 입력 요청 API 없음',
  [AudioRuntimeBlocker.MEDIA_DEVICES_API_UNAVAILABLE]: '미디어 장치 API 없음',
  [AudioRuntimeBlocker.CROSS_ORIGIN_ISOLATION_UNAVAILABLE]: '사이트 격리 없음',
  [AudioRuntimeBlocker.INSECURE_CONTEXT]: '보안 연결 필요',
  [AudioRuntimeBlocker.SHARED_ARRAY_BUFFER_UNAVAILABLE]: '공유 메모리 API 없음',
  [AudioRuntimeBlocker.WEBASSEMBLY_API_UNAVAILABLE]: 'WebAssembly API 없음',
};

export const audioRuntimeFeatureStatusLabels = {
  available: '사용 가능',
  blocked: '환경 차단',
  unsupported: '미구현',
} as const;

export function describeAudioRuntimeFeatureCapability(capability: AudioRuntimeFeatureCapability): string {
  if (capability.status === 'available') {
    return '현재 브라우저에서 사용할 수 있음';
  }
  if (capability.status === 'unsupported') {
    return '현재 runtime에 구현되지 않음';
  }
  return capability.blockers.map(blocker => audioRuntimeBlockerLabels[blocker]).join(', ');
}
