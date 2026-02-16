import * as Tone from 'tone';
import type { IAudioEngine } from './i-audio-engine';

interface TrackNodes {
  player: Tone.Player;
  channel: Tone.Channel;
}

export class AudioEngine implements IAudioEngine {
  private tracks = new Map<string, TrackNodes>();

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
    // Master volume control (decibels)
    // Tone.Destination.volume.value = Tone.gainToDb(value);
    // For now keeping it simple or mapping 0-1 to dB
    Tone.getDestination().volume.value =
      value <= 0 ? -Infinity : 20 * Math.log10(value);
  }

  seekTo(time: number): void {
    console.log(`[AudioEngine] Seek to: ${time}`);
    Tone.getTransport().seconds = time;
  }

  async loadFile(file: File): Promise<{ src: string }> {
    const src = URL.createObjectURL(file);
    console.log(`[AudioEngine] Loading track from ${src}`);
    return { src };
  }

  createTrack(id: string): void {
    console.log(`[AudioEngine] Create Track: ${id}`);
    if (this.tracks.has(id)) {
      console.warn(`[AudioEngine] Track ${id} already exists`);
      return;
    }
    const channel = new Tone.Channel().toDestination();
    const player = new Tone.Player().connect(channel);
    this.tracks.set(id, { channel, player });
  }

  async setTrackSource(id: string, src: string): Promise<void> {
    console.log(`[AudioEngine] setTrackSource: ${id}, ${src}`);

    const track = this.tracks.get(id);

    if (!track) {
      console.error(`[AudioEngine] Track ${id} not found`);
      throw new Error(`Track ${id} not found`);
    }

    console.log(`[AudioEngine] Loading source for ${id}`);
    track.player.stop(); // Stop potential playback
    await track.player.load(src);
    // Ensure sync
    track.player.sync().start(0);
  }

  setTrackVolume(id: string, volume: number): void {
    const track = this.tracks.get(id);
    if (track) {
      // volume is 0.0 to 1.0
      // Tone.Channel.volume is in decibels
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
      track.player.dispose();
      track.channel.dispose();
      this.tracks.delete(id);
    }
  }
}
