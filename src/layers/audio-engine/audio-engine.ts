import * as Tone from 'tone';
import type { IAudioEngine } from './i-audio-engine';
import type { RegionState } from '../session/session';

interface TrackNodes {
  channel: Tone.Channel;
}

interface RegionNodes {
  player: Tone.Player;
  trackId: string;
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

    this.regions.set(region.id, { player, trackId });
  }

  removeRegion(_trackId: string, regionId: string): void {
    console.log(`[AudioEngine] Remove Region: ${regionId}`);
    const regionNode = this.regions.get(regionId);
    if (regionNode) {
      regionNode.player.dispose();
      this.regions.delete(regionId);
    }
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
}
