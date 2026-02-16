import * as Tone from 'tone';
import { audioBufferToWav } from '@/components/Daw/components/ExportButton/utils/wavConverter';
import type { Track } from '@/types/track';
import { loadAndDecodeAudioBuffer } from './loadAndDecodeAudioBuffer';
import { AudioEngineError, AudioEngineErrorCode } from './audioEngine.errors';
import { RegionRenderer } from './regionRenderer';
import {
  PLAYER_CONFIG,
  configurePlayerLoop,
  startPlayer,
} from './playerConfig';

/**
 * 프로젝트 전체를 오디오 파일로 내보냅니다.
 * Tone.Offline을 사용하여 정확한 타이밍과 이펙트(Volume, Pan 등)를 반영합니다.
 * 
 * @param tracks - 내보낼 트랙 목록
 * @param range - 내보내기 범위 (선택사항)
 * @returns WAV 형식의 Blob
 * @throws {AudioEngineError} 내보내기 실패 시
 */
export async function exportProject(
  tracks: Track[],
  range?: { startTime: number; endTime: number }
): Promise<Blob> {
  if (tracks.length === 0) {
    throw new AudioEngineError(
      AudioEngineErrorCode.EXPORT_NO_TRACKS,
      'No tracks to export'
    );
  }

  // 1. 오디오 파일 미리 로드 및 decode (Offline 렌더링 중에는 비동기 로딩 불가)
  const audioBuffers = await preloadAudioBuffers(tracks);

  // 2. 전체 길이 계산 (Range가 있으면 Range 길이, 없으면 전체 길이)
  const totalDuration = range
    ? range.endTime - range.startTime
    : getTotalDuration({ tracks });

  if (totalDuration <= 0) {
    throw new AudioEngineError(
      AudioEngineErrorCode.EXPORT_ZERO_DURATION,
      'Export duration must be greater than 0',
      { totalDuration, range }
    );
  }

  // 3. Offline Rendering
  const renderedBuffer = await renderBuffer({
    tracks,
    totalDuration,
    audioBuffers,
    range,
  });

  // 4. WAV 변환
  const audioBuffer = renderedBuffer.get();
  if (!audioBuffer) {
    throw new AudioEngineError(
      AudioEngineErrorCode.RENDER_FAILED,
      'Failed to render audio buffer'
    );
  }

  const wavBlob = audioBufferToWav(audioBuffer);
  return wavBlob;
}

async function preloadAudioBuffers(tracks: Track[]) {
  const audioBuffers = new Map<string, AudioBuffer>();
  const context = Tone.getContext();

  await Promise.all(
    tracks.flatMap(track =>
      track.regions.map(async region => {
        const audioUrl = region.audioFile.url;
        const audioBuffer = await loadAndDecodeAudioBuffer({
          audioContext: context,
          audioUrl,
        });
        audioBuffers.set(audioUrl, audioBuffer);
      })
    )
  );

  return audioBuffers;
}

/**
 * 전체 프로젝트 길이 계산
 * 
 * @param tracks - 트랙 목록
 * @returns 전체 길이 (초)
 * @throws {AudioEngineError} 길이가 0인 경우
 */
function getTotalDuration({ tracks }: { tracks: Track[] }): number {
  let totalDuration = 0;

  tracks.forEach(track => {
    track.regions.forEach(region => {
      const duration = region.audioFile.duration ?? 0;
      const endPoint = region.startTime + duration;
      if (endPoint > totalDuration) {
        totalDuration = endPoint;
      }
    });
  });

  if (totalDuration === 0) {
    throw new AudioEngineError(
      AudioEngineErrorCode.EXPORT_ZERO_DURATION,
      'Project duration is 0. Please add audio regions to tracks.'
    );
  }

  return totalDuration;
}

async function renderBuffer({
  tracks,
  totalDuration,
  audioBuffers,
  range,
}: {
  tracks: Track[];
  totalDuration: number;
  audioBuffers: Map<string, AudioBuffer>;
  range?: { startTime: number; endTime: number };
}) {
  return await Tone.Offline(({ transport }: { transport: ReturnType<typeof Tone.getTransport> }) => {
    tracks.forEach(track => {
      // Note: renderBuffer는 별도의 AudioEngine 인스턴스가 필요 없음
      // Export 시에는 Store에서 가져온 Track의 volume/pan 값을 사용
      const channel = new Tone.Channel({
        volume: track.volume ? Tone.gainToDb(track.volume) : 0,
        pan: track.pan ?? 0,
      }).toDestination();

      track.regions.forEach(region => {
        const buffer = audioBuffers.get(region.audioFile.url);
        if (!buffer) return;

        // ✅ RegionRenderer로 파라미터 계산 (공통 로직)
        const baseParams = RegionRenderer.calculateRenderParams(region);
        const adjustedParams = RegionRenderer.adjustForExportRange(baseParams, range);

        // duration이 0이면 스킵 (Export 범위 밖)
        if (adjustedParams.duration <= 0) {
          return;
        }

        const player = new Tone.Player({
          url: buffer,
          loop: false,
          ...PLAYER_CONFIG,  // ✅ 공통 설정 (fadeIn, fadeOut)
        }).connect(channel);

        /**
         * ✅ CRITICAL: loopEnd를 설정하여 정확한 구간만 렌더링
         * 
         * AudioEngine과 exportProject 공통 로직:
         * - loopStart/loopEnd로 명시적 구간 제한
         * - Tone.Player는 loop가 false여도 loopEnd를 존중
         * - 이를 통해 Split된 Region이 정확한 길이만큼만 재생됩니다.
         * 
         * RegionRenderer가 계산한 파라미터 사용:
         * - startTime: 타임라인에서 시작 시간
         * - startOffset: 소스 파일에서 시작 위치 (sourceStartTime 반영)
         * - duration: 재생할 길이 (Export range에 의해 조정됨)
         * 
         * 참고: playerConfig.ts의 공통 함수로 관리됩니다.
         */
        // ✅ 공통 함수로 loopStart/loopEnd 설정
        configurePlayerLoop(
          player,
          adjustedParams.startOffset,
          adjustedParams.duration
        );

        // ✅ 공통 함수로 Player 시작 (즉시 재생 모드)
        startPlayer({
          player,
          syncMode: false,
          startTime: adjustedParams.startTime,
          startOffset: adjustedParams.startOffset,
          duration: adjustedParams.duration,
        });
      });
    });

    // Transport 시작
    transport.start();
  }, totalDuration);
}
