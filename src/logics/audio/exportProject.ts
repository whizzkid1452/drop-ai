import * as Tone from 'tone';
import { AudioEngine } from './audioEngine';
import { audioBufferToWav } from '@/components/Daw/components/ExportButton/utils/wavConverter';
import type { Track } from '@/types/track';
import { loadAndDecodeAudioBuffer } from './loadAndDecodeAudioBuffer';

/**
 * 프로젝트 전체를 오디오 파일로 내보냅니다.
 * Tone.Offline을 사용하여 정확한 타이밍과 이펙트(Volume, Pan 등)를 반영합니다.
 */
export async function exportProject(tracks: Track[]): Promise<Blob> {
  if (tracks.length === 0) {
    throw new Error('No tracks to export');
  }

  // 1. 오디오 파일 미리 로드 및 decode (Offline 렌더링 중에는 비동기 로딩 불가)
  const audioBuffers = await preloadAudioBuffers(tracks);

  /** @todo: 추후 start, end time을 직접 지정하도록 로직 수정 예정 */
  // 2. 전체 길이 계산 (가장 늦게 끝나는 Region 기준)
  const totalDuration = getTotalDuration({ tracks });

  // 3. Offline Rendering
  const renderedBuffer = await renderBuffer({
    tracks,
    totalDuration,
    audioBuffers,
  });

  // 4. WAV 변환
  const audioBuffer = renderedBuffer.get();
  if (!audioBuffer) {
    throw new Error('Failed to render audio');
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

function getTotalDuration({ tracks }: { tracks: Track[] }) {
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
    alert('Project duration is 0');
    throw new Error('Project duration is 0');
  }
  return totalDuration;
}

async function renderBuffer({
  tracks,
  totalDuration,
  audioBuffers,
}: {
  tracks: Track[];
  totalDuration: number;
  audioBuffers: Map<string, AudioBuffer>;
}) {
  return await Tone.Offline(({ transport }) => {
    tracks.forEach(track => {
      const engineParams = AudioEngine.getInstance().getTrackParams(track.id);

      if (!engineParams) {
        alert(`Track ${track.id} not found in AudioEngine. Using defaults.`);
      }

      const channel = new Tone.Channel({
        volume: engineParams?.volume ?? 0,
        pan: engineParams?.pan ?? 0,
      }).toDestination();

      track.regions.forEach(region => {
        const buffer = audioBuffers.get(region.audioFile.url);
        if (!buffer) return;

        // 4-2. 플레이어 생성 및 스케줄링
        const player = new Tone.Player({
          url: buffer, // 미리 로드된 버퍼 사용
          loop: false,
        }).connect(channel);

        player.start(region.startTime);
      });
    });

    // Transport 시작 (필요한 경우)
    transport.start();
  }, totalDuration);
}
