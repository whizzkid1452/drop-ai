import * as Tone from 'tone';
import { AudioEngine } from './audioEngine';
import { audioBufferToWav } from '@/components/Daw/components/ExportButton/utils/wavConverter';
import type { Track } from '@/types/track';
import { loadAndDecodeAudioBuffer } from './loadAndDecodeAudioBuffer';

/**
 * 프로젝트 전체를 오디오 파일로 내보냅니다.
 * Tone.Offline을 사용하여 정확한 타이밍과 이펙트(Volume, Pan 등)를 반영합니다.
 */
export async function exportProject(
  tracks: Track[],
  range?: { startTime: number; endTime: number }
): Promise<Blob> {
  if (tracks.length === 0) {
    throw new Error('No tracks to export');
  }

  // 1. 오디오 파일 미리 로드 및 decode (Offline 렌더링 중에는 비동기 로딩 불가)
  const audioBuffers = await preloadAudioBuffers(tracks);

  // 2. 전체 길이 계산 (Range가 있으면 Range 길이, 없으면 전체 길이)
  const totalDuration = range
    ? range.endTime - range.startTime
    : getTotalDuration({ tracks });

  if (totalDuration <= 0) {
    throw new Error('Invalid export duration');
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
  range,
}: {
  tracks: Track[];
  totalDuration: number;
  audioBuffers: Map<string, AudioBuffer>;
  range?: { startTime: number; endTime: number };
}) {
  return await Tone.Offline(({ transport }) => {
    if (range == null) {
      alert('Range is not defined');
      return;
    }

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

        // Export 범위 시프트 (exportStartTime 만큼 앞으로 당김)
        const exportStartTime = range.startTime;
        const regionDuration = buffer.duration;
        const regionEndTime = region.startTime + regionDuration;

        // 1. 리전이 Export 범위 밖인 경우 스킵
        if (
          regionEndTime <= range.startTime || // 리전이 범위보다 먼저 끝남
          region.startTime >= range.endTime // 리전이 범위보다 늦게 시작함
        ) {
          return;
        }

        // 2. 재생 시작 시간 및 오프셋 계산
        let playStartTime = region.startTime - exportStartTime;
        let offset = 0;

        /**
         * Case A: 리전이 Export 시작점보다 앞에서 시작 (잘림)
         * [   Region   ]
         *       | Export Start
         *       ^ playStartTime < 0
         *
         * -> playStartTime = 0
         * -> offset = (Export Start - Region Start)
         */
        if (playStartTime < 0) {
          offset = -playStartTime; // exportStartTime - region.startTime
          playStartTime = 0;
        }

        const player = new Tone.Player({
          url: buffer,
          loop: false,
        }).connect(channel);

        player.start(playStartTime, offset);
      });
    });

    // Transport 시작
    transport.start();
  }, totalDuration);
}
