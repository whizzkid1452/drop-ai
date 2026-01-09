import * as Tone from 'tone';
import { useTrackStore } from '@/stores/useTrackStore';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import {
  AudioCommandType,
  type AudioCommand,
} from '@/types/audioCommand.schema';
import { exportProject } from './exportProject';

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
          command.startTime,
          command.startOffset
        );
        break;
      case AudioCommandType.UNLOAD_REGION:
        this.unloadRegion(command.trackId, command.regionId);
        result = true;
        break;
      case AudioCommandType.GET_TRACK_INFO:
        result = this.getTrackInfo();
        break;
      case AudioCommandType.SET_CURRENT_TIME:
        Tone.getTransport().seconds = command.time;
        result = command.time;
        break;
      case AudioCommandType.SET_EXPORT_RANGE:
        // Store update handled in useAudioEngineHandleWithUi
        result = { startTime: command.startTime, endTime: command.endTime };
        break;
      case AudioCommandType.CLEAR_EXPORT_RANGE:
        // Store update handled in useAudioEngineHandleWithUi
        result = true;
        break;
      case AudioCommandType.EXPORT_AUDIO:
        const tracks = Array.from(useTrackStore.getState().tracks.values());
        const { exportStartTime, exportEndTime } = usePlaybackStore.getState();
        const range =
          exportStartTime !== null && exportEndTime !== null
            ? { startTime: exportStartTime, endTime: exportEndTime }
            : undefined;
        result = await exportProject(tracks, range);
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
    startTime: number = 0,
    startOffset: number = 0
  ) {
    this.initTrack(trackId);
    const trackData = this.tracks.get(trackId);
    if (!trackData) return;

    if (trackData.players.has(regionId)) return;

    const player = new Tone.Player({
      url,
      loop: false,
      onload: () => {
        /**
         * sync().start(startTime, offset)
         * startTime: When to start playing on the timeline
         * offset: Where to start playing in the source file
         */
        player.sync().start(startTime, startOffset);
      },
    }).connect(trackData.channel);

    trackData.players.set(regionId, player);
  }

  private unloadRegion(trackId: string, regionId: string) {
    const trackData = this.tracks.get(trackId);
    if (!trackData) return;

    const player = trackData.players.get(regionId);
    if (player) {
      player.stop();
      player.dispose();
      trackData.players.delete(regionId);
    }
  }

  /**
   * Set Track Volume
   * @param volume Linear volume (0.0 to 1.0)
   */
  private setTrackVolume(trackId: string, volume: number) {
    let track = this.tracks.get(trackId);
    if (!track) {
      this.initTrack(trackId);
      track = this.tracks.get(trackId);
    }
    
    if (track) {
      const db = Tone.gainToDb(volume);
      track.channel.volume.rampTo(db, 0.1);
    } else {
        console.warn(`Track ${trackId} initialization failed.`);
    }
  }

  /**
   * Set Track Pan
   * @param pan -1.0 (Left) to 1.0 (Right)
   */
  private setTrackPan(trackId: string, pan: number) {
    let track = this.tracks.get(trackId);
    if (!track) {
        this.initTrack(trackId);
        track = this.tracks.get(trackId);
    }

    if (track) {
      track.channel.pan.rampTo(pan, 0.1);
    } else {
        console.warn(`Track ${trackId} initialization failed.`);
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

  public getSeconds(): number {
    return Tone.getTransport().seconds;
  }
}
