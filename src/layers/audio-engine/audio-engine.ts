import * as Tone from 'tone';
import type { IAudioEngine } from './i-audio-engine';
import type { RegionState } from '../session/session';
import { encodeWav } from '@/utils/wav-encoder';

interface TrackNodes {
  channel: Tone.Channel;
}

interface RegionNodes {
  player: Tone.Player;
  trackId: string;
  startTime: number;
  duration: number;
  offset: number;
}

export class AudioEngine implements IAudioEngine {
  private tracks = new Map<string, TrackNodes>();
  private regions = new Map<string, RegionNodes>();
  private buffers = new Map<string, Tone.ToneAudioBuffer>();

  async play(): Promise<void> {
    console.log('[AudioEngine] Play');
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
  }

  // Debug helper for E2E tests
  constructor() {
    if (typeof window !== 'undefined') {
      // @ts-expect-error - Tone is extended globally for debugging
      window.Tone = Tone;
    }
  }

  stop(): void {
    console.log('[AudioEngine] Stop');
    Tone.getTransport().stop();
  }

  pause(): void {
    console.log('[AudioEngine] Pause');
    Tone.getTransport().pause();
  }

  setVolume(value: number): void {
    console.log(`[AudioEngine] Set Volume: ${value}`);
    Tone.getDestination().volume.value =
      value <= 0 ? -Infinity : 20 * Math.log10(value);
  }

  seekTo(time: number): void {
    console.log(`[AudioEngine] Seek to: ${time}`);
    Tone.getTransport().seconds = time;
  }

  getCurrentTime(): number {
    return Tone.getTransport().seconds;
  }

  async loadFile(file: File): Promise<{ src: string; duration: number }> {
    const src = URL.createObjectURL(file);
    console.log(`[AudioEngine] Loading file from ${src}`);

    // Decode and cache buffer
    const buffer = new Tone.ToneAudioBuffer();
    await buffer.load(src);
    this.buffers.set(src, buffer);

    return { src, duration: buffer.duration };
  }

  createTrack(id: string): void {
    console.log(`[AudioEngine] Create Track: ${id}`);
    if (this.tracks.has(id)) {
      console.warn(`[AudioEngine] Track ${id} already exists`);
      return;
    }
    const channel = new Tone.Channel().toDestination();
    this.tracks.set(id, { channel });
  }

  addRegion(trackId: string, region: RegionState): void {
    console.log(`[AudioEngine] Add Region: ${region.id} to ${trackId}`);
    const track = this.tracks.get(trackId);
    if (!track) {
      console.error(`[AudioEngine] Track ${trackId} not found`);
      return;
    }

    const buffer = this.buffers.get(region.src);
    if (!buffer) {
      console.error(`[AudioEngine] Buffer for ${region.src} not found`);
      return;
    }

    const player = new Tone.Player(buffer).connect(track.channel);

    // Sync to transport
    // start(startTime, offset, duration)
    player.sync().start(region.startTime, region.offset, region.duration);

    this.regions.set(region.id, {
      player,
      trackId,
      startTime: region.startTime,
      duration: region.duration,
      offset: region.offset,
    });
  }

  removeRegion(_trackId: string, regionId: string): void {
    console.log(`[AudioEngine] Remove Region: ${regionId}`);
    const regionNode = this.regions.get(regionId);
    if (regionNode) {
      regionNode.player.dispose();
      this.regions.delete(regionId);
    }
  }

  moveRegion(_trackId: string, regionId: string, newStartTime: number): void {
    console.log(`[AudioEngine] Move Region: ${regionId} to ${newStartTime}s`);
    const regionNode = this.regions.get(regionId);
    if (!regionNode) {
      console.warn(`[AudioEngine] Region ${regionId} not found`);
      return;
    }

    const { player, duration, offset } = regionNode;

    // unsync detach from transport
    player.unsync();

    // stop if playing
    player.stop();

    // reschedule with preserved offset and duration
    player.sync().start(newStartTime, offset, duration);

    // Update stored state
    regionNode.startTime = newStartTime;
  }

  setTrackVolume(id: string, volume: number): void {
    const track = this.tracks.get(id);
    if (track) {
      const db = volume <= 0 ? -Infinity : 20 * Math.log10(volume);
      track.channel.volume.value = db;
    }
  }

  setTrackMute(id: string, muted: boolean): void {
    const track = this.tracks.get(id);
    if (track) {
      track.channel.mute = muted;
    }
  }

  setTrackSolo(id: string, soloed: boolean): void {
    const track = this.tracks.get(id);
    if (track) {
      track.channel.solo = soloed;
    }
  }

  setTrackPan(id: string, pan: number): void {
    const track = this.tracks.get(id);
    if (track) {
      track.channel.pan.value = pan;
    }
  }

  removeTrack(id: string): void {
    console.log(`[AudioEngine] Removing track: ${id}`);
    const track = this.tracks.get(id);
    if (track) {
      track.channel.dispose();
      this.tracks.delete(id);
    }

    // Also remove all regions associated with this track
    for (const [regionId, regionNode] of this.regions) {
      if (regionNode.trackId === id) {
        this.removeRegion(id, regionId);
      }
    }
  }

  setLoop(loop: boolean): void {
    console.log(`[AudioEngine] Set Loop: ${loop}`);
    Tone.getTransport().loop = loop;
  }

  setLoopPoints(start: number, end: number): void {
    console.log(`[AudioEngine] Set Loop Points: ${start} -> ${end}`);
    Tone.getTransport().loopStart = start;
    Tone.getTransport().loopEnd = end;
  }

  setBpm(bpm: number): void {
    console.log(`[AudioEngine] Set BPM: ${bpm}`);
    Tone.getTransport().bpm.value = bpm;
  }

  getDebugInfo(): string {
    const t = Tone.getTransport();
    let info = `Transport: State=${t.state}, Loop=${t.loop}, BPM=${t.bpm.value}, Pos=${t.position}\n`;
    info += `LoopPoints: ${t.loopStart} -> ${t.loopEnd}\n`;
    info += `Tracks: ${this.tracks.size}, Regions: ${this.regions.size}, Buffers: ${this.buffers.size}\n`;

    this.regions.forEach((r, id) => {
      info += `  [${id}] Track=${r.trackId} Start=${r.player.start} Offset=${r.offset} Dur=${r.duration} State=${r.player.state}\n`;
      // Note: Tone.Player doesn't expose 'start' time property easily if synced.
      // But we stored it in 'r.duration' etc.
    });
    return info;
  }

  async exportSession(
    duration: number,
    tracks: Map<
      string,
      {
        volume: number;
        isMuted: boolean;
        isSoloed: boolean;
        pan: number;
        regions: RegionState[];
      }
    >
  ): Promise<Blob> {
    console.log(`[AudioEngine] Exporting session: ${duration}s`);

    // Use Tone.Offline to render audio
    const buffer = await Tone.Offline(({ transport }) => {
      // 1. Setup Transport
      transport.bpm.value = Tone.getTransport().bpm.value;

      // 2. Reconstruct Tracks & Regions in Offline Context
      tracks.forEach((trackState, _trackId) => {
        const channel = new Tone.Channel().toDestination();
        channel.volume.value =
          trackState.volume <= 0
            ? -Infinity
            : 20 * Math.log10(trackState.volume);
        channel.mute = trackState.isMuted;
        channel.solo = trackState.isSoloed;
        channel.pan.value = trackState.pan;

        trackState.regions.forEach(region => {
          const originalBuffer = this.buffers.get(region.src);
          if (originalBuffer) {
            const player = new Tone.Player(originalBuffer).connect(channel);
            player
              .sync()
              .start(region.startTime, region.offset, region.duration);
          }
        });
      });

      // 3. Start Transport
      transport.start();
    }, duration);

    // 4. Encode to WAV
    // Tone.Offline returns a ToneAudioBuffer, access native AudioBuffer via .get()
    const wavBlob = encodeWav(buffer.get() as AudioBuffer);
    return wavBlob;
  }
}
