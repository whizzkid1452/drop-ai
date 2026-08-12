import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { type SessionStore } from '../session/session';
import {
  TimelineCoordinateMapper,
  type TimelineMeterChange,
  type TimelineTempoChange,
} from '../shared/timeline-coordinate-mapper';

interface SetTimelineMapRequest {
  readonly tempoChanges: readonly TimelineTempoChange[];
  readonly meterChanges: readonly TimelineMeterChange[];
}

export class PlaybackController {
  constructor(
    private sessionStore: SessionStore,
    private audioEngine: IAudioEngine
  ) {}

  async handlePlay(): Promise<void> {
    console.log('[PlaybackController] Handling Play Request');

    // 1. Command Audio Engine
    await this.audioEngine.play();

    // 2. Update Session State via Zustand Actions
    this.sessionStore.getState().setPlaying(true);
  }

  handleStop(): void {
    console.log('[PlaybackController] Handling Stop Request');

    // 1. Command Audio Engine
    this.audioEngine.stop();

    // 2. Update Session State
    this.sessionStore.getState().stopPlayback();
  }

  handlePause(): void {
    console.log('[PlaybackController] Handling Pause Request');

    // 1. Command Audio Engine
    this.audioEngine.pause();
    const currentTime = this.audioEngine.getCurrentTime();

    // 2. Update Session State
    this.sessionStore.getState().pausePlayback(currentTime);
  }

  handleSeek(time: number): void {
    console.log(`[PlaybackController] Seeking to ${time}`);

    // Command Audio Engine
    this.audioEngine.setTime(time);

    // Update Session State
    this.sessionStore.getState().setCurrentTime(time);
  }

  handleSetTempo(tempo: number): void {
    console.log(`[PlaybackController] Setting tempo to ${tempo}`);

    // Region 좌표가 절대 초이므로 BPM으로 기존 예약 시점을 바꾸지 않는다.
    this.sessionStore.getState().setTempo(tempo);
  }

  handleSetTimelineMap({ tempoChanges, meterChanges }: SetTimelineMapRequest): void {
    const initialTempo = tempoChanges[0];
    const initialMeter = meterChanges[0];
    if (!initialTempo || !initialMeter) {
      throw new Error('Tempo·Meter Map에는 0 위치 marker가 필요합니다.');
    }

    // Session을 바꾸기 전에 전체 Map을 검증해 Tempo와 Meter가 부분 반영되지 않게 합니다.
    new TimelineCoordinateMapper({
      tempoBpm: initialTempo.bpm,
      beatsPerBar: initialMeter.beatsPerBar,
      beatUnit: initialMeter.beatUnit,
      tempoChanges,
      meterChanges,
    });
    this.sessionStore.getState().setTimelineMap({ tempoChanges, meterChanges });
  }

  getCurrentTime(): number {
    return this.audioEngine.getCurrentTime();
  }
}
