import { AudioCommandType, type AudioCommand } from '@/types/audioEngine';
import * as Tone from 'tone';
import { useTrackStore } from '@/stores/useTrackStore';

/**
 * AudioEngine (Tone.js Version)
 * - Wraps Tone.js functionality
 * - Manages Tracks (Channels) and Regions (Players)
 * - Implements Gateway pattern via execute()
 */
export class AudioEngine {
  private static instance: AudioEngine;

  private tracks: Map<
    string,
    {
      channel: Tone.Channel;
      players: Map<string, Tone.Player>;
    }
  > = new Map();

  private constructor() {
    // Initial Setup if needed
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  /**
   * Gateway for all Audio Commands
   */
  public async execute({
    command,
    callback,
  }: {
    command: AudioCommand;
    callback?: ({
      command,
      result,
    }: {
      command: AudioCommand;
      /** @todo 추후 AudioCommand와 조합되는 타입 선언 필요 */
      result: any;
    }) => void;
  }) {
    let result;
    switch (command.type) {
      case AudioCommandType.PLAY:
        if (Tone.getContext().state !== 'running') {
          await Tone.start();
        }
        await Tone.getTransport().start();
        result = true;
        break;
      case AudioCommandType.PAUSE:
        result = Tone.getTransport().pause();
        break;
      case AudioCommandType.STOP:
        result = Tone.getTransport().stop();
        break;
      case AudioCommandType.SET_TRACK_VOLUME:
        result = this.setTrackVolume(command.trackId, command.volume);
        break;
      case AudioCommandType.SET_TRACK_PAN:
        result = this.setTrackPan(command.trackId, command.pan);
        break;
      case AudioCommandType.LOAD_REGION:
        result = this.loadRegion(
          command.trackId,
          command.regionId,
          command.url,
          command.startTime
        );
        break;
      case AudioCommandType.GET_TRACK_INFO:
        result = this.getTrackInfo();
        break;
    }
    callback?.({ command, result });
    return result;
  }

  private getTrackInfo() {
    const tracks = useTrackStore.getState().getTracks();
    return Array.from(tracks.entries());
  }

  private initTrack(trackId: string) {
    if (this.tracks.has(trackId)) return;

    const channel = new Tone.Channel({
      volume: 0,
      pan: 0,
    }).toDestination();

    this.tracks.set(trackId, {
      channel,
      players: new Map(),
    });
  }

  private async loadRegion(
    trackId: string,
    regionId: string,
    url: string,
    startTime: number = 0
  ) {
    this.initTrack(trackId);
    const trackData = this.tracks.get(trackId);
    if (!trackData) return;

    if (trackData.players.has(regionId)) return;

    const player = new Tone.Player({
      url,
      loop: false,
      onload: () => {
        player.sync().start(startTime);
      },
    }).connect(trackData.channel);

    trackData.players.set(regionId, player);
  }

  /**
   * Set Track Volume
   * @param volume Linear volume (0.0 to 1.0)
   */
  private setTrackVolume(trackId: string, volume: number) {
    const track = this.tracks.get(trackId);
    if (track) {
      const db = Tone.gainToDb(volume);
      track.channel.volume.rampTo(db, 0.1);
    }
  }

  /**
   * Set Track Pan
   * @param pan -1.0 (Left) to 1.0 (Right)
   */
  private setTrackPan(trackId: string, pan: number) {
    const track = this.tracks.get(trackId);
    if (track) {
      track.channel.pan.rampTo(pan, 0.1);
    }
  }
  /** @todo: 추후 불필요한 캡슐화면 public으로 channel에 접근할 수도 있음 */
  /**
   * Get current track parameters (Volume, Pan) from the Engine
   * This serves as the Source of Truth for audio export
   */
  public getTrackParams(
    trackId: string
  ): { volume: number; pan: number } | null {
    const track = this.tracks.get(trackId);
    if (!track) return null;

    return {
      volume: track.channel.volume.value, // dB
      pan: track.channel.pan.value,
    };
  }

  /**
   * Dispose Track Resources (Prevent Memory Leak)
   * - Disposes all Players in the track
   * - Disposes the Channel
   * - Removes from internal Map
   * 
   * MUST be called when removing a track to prevent:
   * 1. Memory leaks
   * 2. Background audio processing (CPU usage)
   */
  public disposeTrack(trackId: string): boolean {
    const track = this.tracks.get(trackId);
    if (!track) {
      console.warn(`[AudioEngine] Track ${trackId} not found for disposal`);
      return false;
    }

    try {
      // 1. Dispose all Players
      track.players.forEach((player, regionId) => {
        player.dispose();
        console.log(`[AudioEngine] Disposed Player: ${regionId}`);
      });

      // 2. Dispose Channel
      track.channel.dispose();
      console.log(`[AudioEngine] Disposed Channel: ${trackId}`);

      // 3. Remove from Map
      this.tracks.delete(trackId);
      
      console.log(`[AudioEngine] ✅ Track ${trackId} fully disposed`);
      return true;
    } catch (err) {
      console.error(`[AudioEngine] Failed to dispose track ${trackId}:`, err);
      return false;
    }
  }

  /**
   * Dispose ALL Tracks (for Project Close / Reset)
   */
  public disposeAllTracks(): void {
    const trackIds = Array.from(this.tracks.keys());
    trackIds.forEach(trackId => this.disposeTrack(trackId));
    console.log(`[AudioEngine] ✅ Disposed ${trackIds.length} tracks`);
  }
}
