import type { AudioFile } from '@/components/Daw/components/FileUpload/components/types';

/**
 * 오디오 파일을 ArrayBuffer로 로드하는 함수
 *
 * @param audioFile - 로드할 오디오 파일
 * @returns Promise<ArrayBuffer> - 오디오 데이터
 * @throws {Error} 파일 로드 실패 시
 */
export async function loadAudioFile(
  audioFile: AudioFile
): Promise<ArrayBuffer> {
  const response = await fetch(audioFile.url);
  if (!response.ok) {
    throw new Error(`Failed to load audio file: ${audioFile.name}`);
  }
  return response.arrayBuffer();
}

/**
 * 여러 오디오 파일을 로드하고 디코딩하는 함수
 *
 * @param audioContext - Web Audio API 컨텍스트
 * @param audioFiles - 로드할 오디오 파일 배열
 * @param onProgress - 진행 상태 콜백 (0 ~ 100)
 * @returns Promise<AudioBuffer[]> - 디코딩된 오디오 버퍼 배열
 * @throws {Error} 파일 로드 또는 디코딩 실패 시
 */
export async function loadAndDecodeAudioFiles({
  audioContext,
  audioFiles,
  onProgress,
}: {
  audioContext: AudioContext;
  audioFiles: AudioFile[];
  onProgress?: (progress: number) => void;
}): Promise<AudioBuffer[]> {
  const decodedAudioBuffers: AudioBuffer[] = [];
  const totalTracks = audioFiles.length;

  for (let i = 0; i < audioFiles.length; i++) {
    const track = audioFiles[i];
    const progress = (i / totalTracks) * 50;
    onProgress?.(progress);

    try {
      const arrayBuffer = await loadAudioFile(track);

      const decodedAudioBuffer =
        await audioContext.decodeAudioData(arrayBuffer);
      decodedAudioBuffers.push(decodedAudioBuffer);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to load track: ${track.name}`, error);
      throw new Error(`Failed to load track "${track.name}": ${errorMessage}`);
    }
  }

  return decodedAudioBuffers;
}

/**
 * 오디오 파일의 재생 시간(초)을 추출하는 함수
 *
 * @param file - 재생 시간을 추출할 오디오 파일
 * @returns Promise<number> - 재생 시간(초)
 * @throws {Error} 파일 읽기 실패 시
 */
export function getFileDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(url);
    };

    audio.addEventListener('loadedmetadata', () => {
      cleanup();
      resolve(audio.duration);
    });

    audio.addEventListener('error', () => {
      cleanup();
      reject(new Error('Unable to read the file.'));
    });

    audio.src = url;
  });
}
