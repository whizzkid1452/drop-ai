import * as Tone from 'tone';
import type { ExportRequest, ExportTrack, IAudioEngine, RegionData } from './i-audio-engine';
import { startPlayer } from './config/player-config';
import { RegionRenderer, type RegionRenderParams } from './renderers/region-renderer';
import { encodeAudioBufferToWav } from './encoders/wav-encoder';
import { AudioEngineError, AudioEngineErrorCode, ERROR_MESSAGES } from './errors';

interface AudioEngineOptions {
  initialTempo: number;
}

/**
 * AudioEngine - Tone.js 기반 오디오 엔진 구현
 *
 * 아키텍처 규칙:
 * - audio-engine만 Tone.js에 접근 가능
 * - Controllers에서만 호출됨
 */
export class AudioEngine implements IAudioEngine {
  // Tone.js Objects
  private channels: Map<string, Tone.Channel> = new Map();
  private players: Map<string, Map<string, Tone.Player>> = new Map();

  constructor(options: AudioEngineOptions = { initialTempo: 120 }) {
    // 상태 저장소 대신 초기값만 받아 AudioEngine의 Session 의존을 막는다.
    Tone.Transport.bpm.value = options.initialTempo;
  }

  // ===== Transport Control =====

  async play(): Promise<void> {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    await Tone.getTransport().start();
  }

  pause(): void {
    Tone.getTransport().pause();
  }

  stop(): void {
    Tone.getTransport().stop();
  }

  setTime(time: number): void {
    Tone.getTransport().seconds = time;
  }

  getCurrentTime(): number {
    return Tone.getTransport().seconds;
  }

  setTempo(tempo: number): void {
    Tone.Transport.bpm.value = tempo;
  }

  // ===== Track Management =====

  async loadTrack(url: string, id: string): Promise<void> {
    console.log(`[AudioEngine] Loading track ${id} from ${url}`);
    // 기본 트랙 채널 초기화
    this.getOrInitChannel(id);
  }

  removeTrack(trackId: string): void {
    const trackPlayers = this.players.get(trackId);
    trackPlayers?.forEach(player => this.disposePlayer(player));
    this.players.delete(trackId);

    const channel = this.channels.get(trackId);
    channel?.disconnect();
    channel?.dispose();
    this.channels.delete(trackId);
  }

  private getOrInitChannel(trackId: string): Tone.Channel {
    let channel = this.channels.get(trackId);
    if (!channel) {
      channel = new Tone.Channel({
        volume: 0,
        pan: 0,
      }).toDestination();
      this.channels.set(trackId, channel);
      this.players.set(trackId, new Map());
    }
    return channel;
  }

  setTrackVolume(trackId: string, volume: number): void {
    const channel = this.getOrInitChannel(trackId);
    const volumeInDb = Tone.gainToDb(volume);
    channel.volume.rampTo(volumeInDb, 0.1);
  }

  setTrackPan(trackId: string, pan: number): void {
    const channel = this.getOrInitChannel(trackId);
    channel.pan.rampTo(pan, 0.1);
  }

  getTrackParams(trackId: string): { volume: number; pan: number } | null {
    const channel = this.channels.get(trackId);
    if (!channel) return null;

    return {
      volume: Tone.dbToGain(channel.volume.value),
      pan: channel.pan.value,
    };
  }

  // ===== Region Management =====

  async addRegion(trackId: string, regionData: RegionData): Promise<void> {
    console.log('[AudioEngine] addRegion called', { trackId, regionData });

    const channel = this.getOrInitChannel(trackId);
    const trackPlayers = this.players.get(trackId)!;

    if (trackPlayers.has(regionData.id)) {
      console.log('[AudioEngine] Player already exists for region', regionData.id);
      return;
    }

    return new Promise((resolve, reject) => {
      const player = new Tone.Player({
        url: regionData.url,
        loop: false,
        onload: () => {
          console.log('[AudioEngine] Player loaded for region', regionData.id);

          // Tone.js Player 동기화
          startPlayer({
            player,
            syncMode: true,
            startTime: regionData.startTime,
            startOffset: regionData.sourceStartTime,
            duration: regionData.duration,
          });

          resolve();
        },
        onerror: e => {
          console.error('[AudioEngine] Player load error', e);
          reject(e);
        },
      }).connect(channel);

      trackPlayers.set(regionData.id, player);
    });
  }

  removeRegion(trackId: string, regionId: string): void {
    const trackPlayers = this.players.get(trackId);
    const player = trackPlayers?.get(regionId);

    if (player) {
      this.disposePlayer(player);
      trackPlayers?.delete(regionId);
    }
  }

  private disposePlayer(player: Tone.Player): void {
    // Transport 예약을 먼저 해제해야 삭제된 Region이 이후 재생되지 않는다.
    player.unsync();
    player.stop();
    player.disconnect();
    player.dispose();
  }

  // ===== Export =====

  async exportProject(request: ExportRequest): Promise<Blob> {
    const duration = request.range.endTime - request.range.startTime;
    if (duration <= 0) {
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_ZERO_DURATION, ERROR_MESSAGES.EXPORT_ZERO_DURATION);
    }
    if (request.tracks.length === 0) {
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_NO_TRACKS, ERROR_MESSAGES.EXPORT_NO_TRACKS);
    }

    try {
      const renderedBuffer = await Tone.Offline(
        async () => this.scheduleExport(request),
        duration,
        2,
        request.sampleRate
      );
      const audioBuffer = renderedBuffer.get();
      if (!audioBuffer) {
        throw new AudioEngineError(AudioEngineErrorCode.RENDER_FAILED, ERROR_MESSAGES.RENDER_FAILED);
      }
      return encodeAudioBufferToWav(audioBuffer);
    } catch (error) {
      if (error instanceof AudioEngineError) {
        throw error;
      }
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_FAILED, ERROR_MESSAGES.EXPORT_FAILED, {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async scheduleExport(request: ExportRequest): Promise<void> {
    const scheduledPlayers: Array<{ player: Tone.Player; params: RegionRenderParams }> = [];

    for (const track of this.getAudibleTracks(request.tracks)) {
      const channel = new Tone.Channel({
        volume: Tone.gainToDb(track.volume * request.masterVolume),
        pan: track.pan,
      }).toDestination();

      for (const region of track.regions) {
        const params = RegionRenderer.adjustForExportRange(RegionRenderer.calculateRenderParams(region), request.range);
        if (params.duration <= 0) continue;

        scheduledPlayers.push({ player: new Tone.Player({ loop: false }).connect(channel), params });
      }
    }

    await Promise.all(scheduledPlayers.map(({ player, params }) => player.load(params.url)));

    // 모든 파일을 먼저 디코딩해야 OfflineAudioContext가 빈 버퍼를 렌더링하지 않는다.
    scheduledPlayers.forEach(({ player, params }) => {
      startPlayer({ player, syncMode: false, ...params });
    });
  }

  private getAudibleTracks(tracks: ExportTrack[]): ExportTrack[] {
    const hasSoloTrack = tracks.some(track => track.isSoloed);
    return tracks.filter(track => !track.isMuted && (!hasSoloTrack || track.isSoloed));
  }
}
