/**
 * Web Audio API의 AudioContext 및 오디오 노드 관리 유틸리티
 */

export interface AudioNodes {
  gainNode: GainNode;
  pannerNode: StereoPannerNode;
}

/**
 * AudioContext 생성 (브라우저 호환성 고려)
 */
export function createAudioContext(): AudioContext {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API를 지원하지 않는 브라우저입니다.');
  }
  return new AudioContextClass();
}

/**
 * 오디오 노드 생성 및 연결
 * 
 * @param audioContext - AudioContext 인스턴스
 * @param volume - 초기 볼륨 값 (0.0 ~ 1.0)
 * @param pan - 초기 패닝 값 (-1.0 ~ 1.0)
 * @returns 생성된 GainNode와 StereoPannerNode
 */
export function createAudioNodes(
  audioContext: AudioContext,
  volume: number,
  pan: number
): AudioNodes {
  // GainNode 생성 (볼륨 제어)
  const gainNode = audioContext.createGain();
  gainNode.gain.value = Math.max(0, Math.min(1, volume));

  // StereoPannerNode 생성 (패닝 제어)
  const pannerNode = audioContext.createStereoPanner();
  pannerNode.pan.value = Math.max(-1, Math.min(1, pan));

  return { gainNode, pannerNode };
}

/**
 * 오디오 노드 체인 연결
 * source -> gain -> panner -> destination
 * 
 * @param sourceNode - AudioBufferSourceNode
 * @param nodes - GainNode와 StereoPannerNode
 * @param destination - 최종 출력 대상 (기본값: audioContext.destination)
 */
export function connectAudioNodes(
  sourceNode: AudioBufferSourceNode,
  nodes: AudioNodes,
  destination: AudioDestinationNode
): void {
  sourceNode.connect(nodes.gainNode);
  nodes.gainNode.connect(nodes.pannerNode);
  nodes.pannerNode.connect(destination);
}

/**
 * 볼륨 값 업데이트
 * 
 * @param gainNode - GainNode 인스턴스
 * @param volume - 새로운 볼륨 값 (0.0 ~ 1.0)
 * @param audioContext - AudioContext (타이밍 계산용)
 */
export function updateVolume(
  gainNode: GainNode,
  volume: number,
  audioContext: AudioContext
): void {
  const clampedValue = Math.max(0, Math.min(1, volume));
  gainNode.gain.setValueAtTime(clampedValue, audioContext.currentTime);
}

/**
 * 패닝 값 업데이트
 * 
 * @param pannerNode - StereoPannerNode 인스턴스
 * @param pan - 새로운 패닝 값 (-1.0 ~ 1.0)
 * @param audioContext - AudioContext (타이밍 계산용)
 */
export function updatePan(
  pannerNode: StereoPannerNode,
  pan: number,
  audioContext: AudioContext
): void {
  const clampedValue = Math.max(-1, Math.min(1, pan));
  pannerNode.pan.setValueAtTime(clampedValue, audioContext.currentTime);
}
