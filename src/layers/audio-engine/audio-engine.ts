import * as Tone from 'tone';
import type { IAudioEngine, RegionData, ExportOptions } from './i-audio-engine';
import { startPlayer } from './config/player-config';

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
      player.unsync();
      player.stop();
      player.disconnect();
      player.dispose();
      trackPlayers?.delete(regionId);
    }
  }

  // ===== Export =====

  async exportProject(options?: ExportOptions): Promise<Blob> {
    console.log('[AudioEngine] exportProject called', options);

    // TODO: 실제 export 구현
    // 지금은 기본 WAV Blob 반환
    const sampleRate = 44100;
    const duration = 1; // 1초
    const numChannels = 2;
    const numSamples = sampleRate * duration;

    const buffer = new ArrayBuffer(44 + numSamples * numChannels * 2);
    const view = new DataView(buffer);

    // WAV 헤더 작성 (간단한 예시)
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * numChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * numChannels * 2, true);

    return new Blob([buffer], { type: 'audio/wav' });
  }
}
