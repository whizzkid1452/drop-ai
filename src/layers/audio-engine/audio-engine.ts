import * as Tone from 'tone';
import type { IAudioEngine, RegionData, ExportOptions } from './i-audio-engine';
import type { SessionStore } from '../session';

/**
 * AudioEngine - Tone.js 기반 오디오 엔진 구현
 * 
 * 아키텍처 규칙:
 * - audio-engine만 Tone.js에 접근 가능
 * - SessionStore를 통해 상태 업데이트
 * - Controllers에서만 호출됨
 */
export class AudioEngine implements IAudioEngine {
  // Tone.js Objects
  private channels: Map<string, Tone.Channel> = new Map();
  private players: Map<string, Map<string, Tone.Player>> = new Map();
  
  constructor(private sessionStore: SessionStore) {
    // Tone.js Transport 초기화
    Tone.Transport.bpm.value = sessionStore.getState().tempo;
  }

  // ===== Transport Control =====

  async play(): Promise<void> {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    await Tone.getTransport().start();
    this.sessionStore.getState().setPlaying(true);
  }

  pause(): void {
    Tone.getTransport().pause();
    this.sessionStore.getState().setPlaying(false);
  }

  stop(): void {
    Tone.getTransport().stop();
    this.sessionStore.getState().setPlaying(false);
    this.sessionStore.getState().setCurrentTime(0);
  }

  setTime(time: number): void {
    Tone.getTransport().seconds = time;
    this.sessionStore.getState().setCurrentTime(time);
  }

  getCurrentTime(): number {
    return Tone.getTransport().seconds;
  }

  setTempo(tempo: number): void {
    Tone.Transport.bpm.value = tempo;
    this.sessionStore.getState().setTempo(tempo);
  }

  // ===== Track Management =====

  async loadTrack(url: string, id: string): Promise<void> {
    console.log(`[AudioEngine] Loading track ${id} from ${url}`);
    // 기본 트랙 채널 초기화
    this.getOrInitChannel(id);
    // Track은 Controller에서 SessionStore에 추가함
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
    
    // SessionStore 업데이트
    this.sessionStore.getState().updateTrack(trackId, { volume });
  }

  setTrackPan(trackId: string, pan: number): void {
    const channel = this.getOrInitChannel(trackId);
    channel.pan.rampTo(pan, 0.1);
    
    // SessionStore 업데이트
    this.sessionStore.getState().updateTrack(trackId, { pan });
  }

  getTrackParams(trackId: string): { volume: number; pan: number } | null {
    const channel = this.channels.get(trackId);
    if (!channel) return null;
    
    return {
      volume: Tone.dbToGain(channel.volume.value),
      pan: channel.pan.value
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
          
          // Tone.js Player 동기화 (Store 업데이트는 Controller가 담당)
          player.sync().start(regionData.startTime, regionData.sourceStartTime);
          
          resolve();
        },
        onerror: (e) => {
          console.error('[AudioEngine] Player load error', e);
          reject(e);
        }
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

  async splitRegion(trackId: string, splitTime: number): Promise<void> {
    const track = this.sessionStore.getState().tracks.get(trackId);
    if (!track) return;
    
    // splitTime에 해당하는 region 찾기
    const region = track.regions.find(r =>
      splitTime > r.startTime && splitTime < (r.startTime + r.duration)
    );
    
    if (!region) {
      console.warn(`[AudioEngine] No region found at ${splitTime} on track ${trackId}`);
      return;
    }
    
    // 기존 region 제거
    this.removeRegion(trackId, region.id);
    
    // 왼쪽 region
    const leftDuration = splitTime - region.startTime;
    await this.addRegion(trackId, {
      id: `${region.id}-left`,
      url: region.audioFileUrl!,
      startTime: region.startTime,
      sourceStartTime: region.sourceStartTime,
      duration: leftDuration,
    });
    
    // 오른쪽 region
    const rightDuration = region.duration - leftDuration;
    await this.addRegion(trackId, {
      id: `${region.id}-right`,
      url: region.audioFileUrl!,
      startTime: splitTime,
      sourceStartTime: region.sourceStartTime + leftDuration,
      duration: rightDuration,
    });
  }

  moveRegion({ trackId, regionId, newStartTime, sourceStartTime }: { trackId: string; regionId: string; newStartTime: number; sourceStartTime: number }): void {
    const trackPlayers = this.players.get(trackId);
    const player = trackPlayers?.get(regionId);
    
    if (player) {
      // 1. Unsync existing schedule
      if (player.state === 'started') {
        player.stop();
      }
      player.unsync();
      
      // 2. Resync with new startTime using passed sourceStartTime
      // Store lookup removed to prevent "Region not found" errors due to state desync
      player.sync().start(newStartTime, sourceStartTime);
      console.log(`[AudioEngine] Moved region ${regionId} to ${newStartTime}, sourceStart: ${sourceStartTime}`);

    } else {
       console.warn(`[AudioEngine] Player for region ${regionId} not found`);
    }
  }

  // ===== Export =====

  setExportRange(startTime: number | null, endTime: number | null): void {
    this.sessionStore.getState().setExportRange(startTime, endTime);
  }

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

  // ===== Legacy (Compatibility) =====

  setVolume(value: number): void {
    this.sessionStore.getState().setMasterVolume(value);
  }

  seekTo(time: number): void {
    this.setTime(time);
  }
}
