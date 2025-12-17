/**
 * 오디오 유틸리티 함수들의 통합 export
 * 
 * 기존 import 경로를 유지하기 위해 모든 함수를 re-export합니다.
 * 각 기능별 모듈:
 * - audioFileLoader: 파일 로드 관련
 * - audioBufferProcessor: 버퍼 처리 (정규화, 리샘플링)
 * - audioMixing: 믹싱 관련 (Web Audio API의 StereoPannerNode 사용)
 * 
 * 참고: 패닝은 Web Audio API의 StereoPannerNode를 직접 사용합니다.
 * - 재생 시: useAudioPlayback에서 StereoPannerNode 사용
 * - Export 시: audioMixing에서 OfflineAudioContext와 StereoPannerNode 사용
 */

// 파일 로드 관련
export {
  loadAudioFile,
  loadAndDecodeAudioFiles,
  getFileDuration,
} from './audioFileLoader';

// 버퍼 처리 관련
export {
  clampSample,
  normalizeAudioBuffer,
  resampleBuffer,
} from './audioBufferProcessor';

// 믹싱 관련
export { mixAudioBuffers } from './audioMixing';
