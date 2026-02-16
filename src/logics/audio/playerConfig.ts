import * as Tone from 'tone';

/**
 * Tone.Player 공통 설정
 *
 * audioEngine.ts와 exportProject.ts에서 공통으로 사용하는
 * Player 설정값을 한 곳에서 관리합니다.
 */
export const PLAYER_CONFIG = {
  /** Fade In 시간 (초) - 클릭 노이즈 방지 */
  fadeIn: 0.005, // 5ms
  /** Fade Out 시간 (초) - 클릭 노이즈 방지 */
  fadeOut: 0.005, // 5ms
};

/**
 * Player의 loopStart/loopEnd를 설정하여 정확한 구간만 재생
 *
 * Tone.Player는 loop가 false여도 loopEnd를 존중하므로,
 * 이를 통해 Split된 Region이 정확한 길이만큼만 재생됩니다.
 *
 * @param player - 설정할 Tone.Player
 * @param startOffset - 소스 파일에서 시작 위치 (초)
 * @param duration - 재생할 길이 (초)
 *
 * @example
 * ```typescript
 * const player = new Tone.Player({ url: 'audio.wav' });
 * configurePlayerLoop(player, 2, 5); // 2초부터 7초까지 재생
 * ```
 */
export function configurePlayerLoop(
  player: Tone.Player,
  startOffset: number,
  duration: number
): void {
  player.loopStart = startOffset;
  // Safety: Clamp loopEnd to prevent floating-point precision errors
  // Tone.js will throw if loopEnd exceeds actual buffer duration
  const calculatedEnd = startOffset + duration;
  const bufferDuration = player.buffer.duration;
  player.loopEnd = Math.min(calculatedEnd, bufferDuration);
}

/**
 * Player를 시작 (sync 모드 또는 일반 모드)
 *
 * - syncMode=true: Transport에 동기화된 실시간 재생 (audioEngine용)
 * - syncMode=false: 즉시 재생 (exportProject용)
 *
 * @param params - Player 시작 파라미터
 * @param params.player - 시작할 Tone.Player
 * @param params.syncMode - Transport 동기화 여부
 * @param params.startTime - 타임라인에서 시작 시간 (초)
 * @param params.startOffset - 소스 파일에서 시작 오프셋 (초)
 * @param params.duration - 재생 지속 시간 (초, 선택적)
 *
 * @example
 * ```typescript
 * // 실시간 재생 (AudioEngine)
 * startPlayer({
 *   player,
 *   syncMode: true,
 *   startTime: 5,
 *   startOffset: 2,
 *   duration: 3,
 * });
 *
 * // Export (Offline Rendering)
 * startPlayer({
 *   player,
 *   syncMode: false,
 *   startTime: 5,
 *   startOffset: 2,
 *   duration: 3,
 * });
 * ```
 */
export function startPlayer(params: {
  player: Tone.Player;
  syncMode: boolean;
  startTime: number;
  startOffset: number;
  duration?: number;
}): void {
  const { player, syncMode, startTime, startOffset, duration } = params;

  if (syncMode) {
    // Transport에 동기화된 재생 (AudioEngine)
    player.sync().start(startTime, startOffset, duration);
  } else {
    // 즉시 재생 (exportProject)
    player.start(startTime, startOffset, duration);
  }
}
