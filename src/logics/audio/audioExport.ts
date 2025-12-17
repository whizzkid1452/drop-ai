import type { AudioFile } from '@/components/Daw/components/FileUpload/components/types';
import {
  loadAndDecodeAudioFiles,
  mixAudioBuffers,
  normalizeAudioBuffer,
  extractVolumesFromTracks,
  extractPansFromTracks,
} from './audioUtils';
import { DEFAULT_SAMPLE_RATE } from './audioConstants';
import { DEFAULT_BIT_DEPTH } from './wavConverter';
import { audioBufferToWav } from './wavConverter';

/**
 * Export 진행 상태 정보
 */
export interface ExportProgress {
  /** 진행률 (0-100) */
  progress: number;
  /** 현재 단계 설명 */
  stage: 'loading' | 'mixing' | 'encoding' | 'complete';
}

/**
 * Export 설정 옵션
 * Ardour의 ExportSettings를 참고하여 웹 환경에 맞게 구현
 */
export interface ExportSettings {
  /** 샘플레이트 (Hz), 기본값: 44100 */
  sampleRate?: number;
  /** 비트 깊이 (16, 24, 32, 또는 'float'), 기본값: 16 */
  bitDepth?: 16 | 24 | 32 | 'float';
  /** 정규화 여부, 기본값: false */
  normalize?: boolean;
  /** 출력 파일명 (확장자 제외), 기본값: 'export' */
  filename?: string;
}

/**
 * 진행 상태 업데이트 헬퍼
 */
function updateProgress(
  onProgress: ((progress: ExportProgress) => void) | undefined,
  progress: number,
  stage: ExportProgress['stage']
): void {
  onProgress?.({
    progress: Math.max(0, Math.min(100, progress)),
    stage,
  });
}

/**
 * 여러 오디오 트랙을 하나의 WAV 파일로 내보내는 함수
 * Ardour의 export_session 함수를 참고하여 웹 환경에 맞게 구현
 *
 * @param tracks - 내보낼 오디오 트랙 배열
 * @param settings - Export 설정 옵션
 * @param onProgress - 진행 상태 콜백 함수 (선택적)
 * @returns Promise<Blob> - 생성된 WAV 파일 Blob
 * @throws {Error} 트랙이 없거나 처리 중 오류 발생 시
 *
 * @example
 * ```typescript
 * const blob = await exportTracks(tracks, {
 *   sampleRate: 44100,
 *   bitDepth: 16,
 *   normalize: true,
 *   filename: 'my-export'
 * }, (progress) => {
 *   console.log(`진행률: ${progress.progress}%`);
 * });
 *
 * // 파일 다운로드
 * downloadBlob(blob, 'my-export.wav');
 * ```
 */
export async function exportTracks(
  tracks: AudioFile[],
  settings: ExportSettings = {},
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  if (tracks.length === 0) {
    throw new Error('No tracks to export');
  }

  const {
    sampleRate = DEFAULT_SAMPLE_RATE,
    bitDepth = DEFAULT_BIT_DEPTH,
    normalize = false,
  } = settings;

  let audioContext: AudioContext | null = null;

  try {
    // 1. AudioContext 생성
    audioContext = new AudioContext({ sampleRate });
    updateProgress(onProgress, 0, 'loading');

    // 2. 모든 오디오 파일 로드 및 디코딩
    const audioBuffers = await loadAndDecodeAudioFiles({
      audioContext,
      audioFiles: tracks,
      onProgress: progress => {
        updateProgress(() => {}, progress, 'loading');
      },
    });

    updateProgress(onProgress, 50, 'mixing');

    // 3. 모든 버퍼를 하나로 믹싱 (볼륨 및 패닝 적용)
    const volumes = extractVolumesFromTracks(tracks);
    const pans = extractPansFromTracks(tracks);
    const mixedBuffer = await mixAudioBuffers(
      audioContext,
      audioBuffers,
      sampleRate,
      volumes,
      pans
    );

    updateProgress(onProgress, 75, 'mixing');

    // 4. 정규화 (옵션)
    let finalBuffer = mixedBuffer;
    if (normalize) {
      finalBuffer = normalizeAudioBuffer(audioContext, mixedBuffer);
    }

    updateProgress(onProgress, 90, 'encoding');

    // 5. WAV 파일로 변환
    const wavBlob = audioBufferToWav(finalBuffer, bitDepth);

    updateProgress(onProgress, 100, 'complete');

    return wavBlob;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Export failed:', error);
    throw new Error(`Export failed: ${errorMessage}`);
  } finally {
    // AudioContext 정리
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close().catch(err => {
        console.warn('Failed to close AudioContext:', err);
      });
    }
  }
}

