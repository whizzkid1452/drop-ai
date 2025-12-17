import type { AudioFile } from '@/components/Daw/components/FileUpload/components/types';


// URL에서 오디오 파일을 ArrayBuffer로 로드하는 내부 헬퍼 함수
async function fetchRawAudioData(
  url: string,
  fileName?: string
): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    const errorMessage = fileName
      ? `Failed to load audio file: ${fileName}`
      : `오디오 파일 로딩 실패: ${response.status} ${response.statusText}`;
    throw new Error(errorMessage);
  }
  return response.arrayBuffer();
}

// AudioFile 객체에서 ArrayBuffer를 로드하는 함수
// loadAndDecodeAudioFiles에서만 사용
export async function loadAudioFile(
  audioFile: AudioFile
): Promise<ArrayBuffer> {
  const rawAudioData = await fetchRawAudioData(audioFile.url, audioFile.name);
  return rawAudioData;
}

// URL에서 오디오 파일을 로드하고 AudioBuffer로 디코딩
// useAudioPlayback에서 단일 파일 재생 시 사용
export async function loadAudioBuffer(
  audioUrl: string,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  try {
    const rawAudioData = await fetchRawAudioData(audioUrl);
    const decodedAudioBuffer = await audioContext.decodeAudioData(rawAudioData);
    return decodedAudioBuffer;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`오디오 디코딩 실패: ${error.message}`);
    }
    throw new Error('알 수 없는 오디오 로딩 오류가 발생했습니다.');
  }
}

// 여러 오디오 파일을 순차적으로 로드하고 디코딩하는 함수
// audioExport에서 여러 트랙을 하나로 합칠 때 사용
export async function loadAndDecodeAudioFiles({
  audioContext,
  audioFiles,
  onProgress,
}: {
  audioContext: AudioContext;
  audioFiles: AudioFile[];
  onProgress?: (progress: number) => void;
}): Promise<AudioBuffer[]> {
  const decodedBuffersForExport: AudioBuffer[] = [];
  const totalTrackCount = audioFiles.length;

  for (let trackIndex = 0; trackIndex < audioFiles.length; trackIndex++) {
    const currentTrack = audioFiles[trackIndex];
    const loadingProgress = (trackIndex / totalTrackCount) * 50;
    onProgress?.(loadingProgress);

    try {
      const rawAudioData = await loadAudioFile(currentTrack);
      const decodedBufferForExport =
        await audioContext.decodeAudioData(rawAudioData);
      decodedBuffersForExport.push(decodedBufferForExport);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to load track: ${currentTrack.name}`, error);
      throw new Error(`Failed to load track "${currentTrack.name}": ${errorMessage}`);
    }
  }

  return decodedBuffersForExport;
}

// File 객체에서 재생 시간(초)만 추출하는 함수
// useFileUpload에서 파일 업로드 시 duration만 필요할 때 사용
// HTML Audio 엘리먼트 사용 (Web Audio API 미사용)
export function getFileDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audioElement = new Audio();
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    audioElement.addEventListener('loadedmetadata', () => {
      const durationInSeconds = audioElement.duration;
      cleanup();
      resolve(durationInSeconds);
    });

    audioElement.addEventListener('error', () => {
      cleanup();
      reject(new Error('Unable to read the file.'));
    });

    audioElement.src = objectUrl;
  });
}
