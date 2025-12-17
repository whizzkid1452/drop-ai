import type { AudioFile } from '@/components/Daw/components/FileUpload/components/types';
import {
  loadAndDecodeAudioFiles,
  mixAudioBuffers,
  normalizeAudioBuffer,
} from '../../../../../logics/audio/audioUtils';
import { DEFAULT_BIT_DEPTH } from '@/logics/audio/wavConverter';
import type { ExportProgress, ExportSettings } from '../types';
import { audioBufferToWav } from '@/logics/audio/wavConverter';

/** 기본 샘플레이트 (Hz) */
const DEFAULT_SAMPLE_RATE = 44100;

// ============================================================================
// Export 메인 함수
// ============================================================================

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

    // 3. 모든 버퍼를 하나로 믹싱 (볼륨 적용)
    const volumes = tracks.map(track => track.volume ?? 1.0);
    const mixedBuffer = await mixAudioBuffers(
      audioContext,
      audioBuffers,
      sampleRate,
      volumes
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

/**
 * Blob을 파일로 다운로드하는 헬퍼 함수
 *
 * @param blob - 다운로드할 Blob
 * @param filename - 파일명 (확장자 포함)
 * @throws {Error} 다운로드 실패 시
 */
export function downloadBlob(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // URL 정리 (약간의 지연 후 정리하여 다운로드가 완료되도록 함)
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to download blob: ${errorMessage}`);
  }
}

// 타입 재export (기존 import 경로 유지)
export type { ExportProgress, ExportSettings };
