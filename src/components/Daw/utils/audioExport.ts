import type { AudioFile } from '@/components/DropZone/components/FileUpload/components/types';
import { DEFAULT_SAMPLE_RATE } from './constants';
import type { ExportSettings, ExportProgress } from './types';
import {
  loadAudioFile,
  decodeAudioData,
  mixAudioBuffers,
} from './audioUtils';
import { audioBufferToWav } from './wavConverter';

// ============================================================================
// Export 메인 함수
// ============================================================================

/**
 * 진행 상태 업데이트 헬퍼
 */
function updateProgress(
  onProgress: ((progress: ExportProgress) => void) | undefined,
  progress: number
): void {
  onProgress?.({
    progress: Math.max(0, Math.min(100, progress)),
  });
}

/**
 * 모든 오디오 트랙을 로드하고 디코딩
 */
async function loadAndDecodeTracks(
  audioContext: AudioContext,
  tracks: AudioFile[],
  onProgress?: (progress: ExportProgress) => void
): Promise<AudioBuffer[]> {
  const audioBuffers: AudioBuffer[] = [];
  const totalTracks = tracks.length;

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const progress = (i / totalTracks) * 50;
    updateProgress(onProgress, progress);

    try {
      const arrayBuffer = await loadAudioFile(track);
      const audioBuffer = await decodeAudioData(audioContext, arrayBuffer);
      audioBuffers.push(audioBuffer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to load track: ${track.name}`, error);
      throw new Error(`Failed to load track "${track.name}": ${errorMessage}`);
    }
  }

  return audioBuffers;
}

/**
 * 여러 오디오 트랙을 하나의 WAV 파일로 내보내는 함수
 * 
 * @param tracks - 내보낼 오디오 트랙 배열
 * @param onProgress - 진행 상태 콜백 함수 (선택적)
 * @returns Promise<Blob> - 생성된 WAV 파일 Blob
 * @throws {Error} 트랙이 없거나 처리 중 오류 발생 시
 * 
 * @example
 * ```typescript
 * const blob = await exportTracks(tracks, (progress) => {
 *   console.log(`진행률: ${progress.progress}%`);
 * });
 * 
 * // 파일 다운로드
 * downloadBlob(blob, 'my-export.wav');
 * ```
 */
export async function exportTracks(
  tracks: AudioFile[],
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  if (tracks.length === 0) {
    throw new Error('No tracks to export');
  }

  let audioContext: AudioContext | null = null;

  try {
    // 1. AudioContext 생성
    audioContext = new AudioContext({ sampleRate: DEFAULT_SAMPLE_RATE });
    updateProgress(onProgress, 0);

    // 2. 모든 오디오 파일 로드 및 디코딩
    const audioBuffers = await loadAndDecodeTracks(
      audioContext,
      tracks,
      onProgress
    );

    updateProgress(onProgress, 50);

    // 3. 모든 버퍼를 하나로 믹싱
    const mixedBuffer = await mixAudioBuffers(
      audioContext,
      audioBuffers,
      DEFAULT_SAMPLE_RATE
    );

    updateProgress(onProgress, 90);

    // 4. WAV 파일로 변환 (16-bit)
    const wavBlob = audioBufferToWav(mixedBuffer);

    updateProgress(onProgress, 100);

    return wavBlob;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Export failed:', error);
    throw new Error(`Export failed: ${errorMessage}`);
  } finally {
    // AudioContext 정리
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close().catch((err) => {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to download blob: ${errorMessage}`);
  }
}

// 타입 재export (기존 import 경로 유지)
export type { ExportSettings, ExportProgress };
