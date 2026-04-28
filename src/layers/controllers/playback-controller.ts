import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { type SessionStore } from '../session/session';

//AudioEngine = 실제 소리 상태
// SessionStore = UI가 보는 앱 상태
export class PlaybackController {
  //typescript 축약문법: 프로퍼티 선언과 생성자 매개변수를 동시에 선언하는 방법
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
    this.sessionStore.getState().setPlaying(false);
  }

  handlePause(): void {
    console.log('[PlaybackController] Handling Pause Request');

    // 1. Command Audio Engine
    this.audioEngine.pause();

    // 2. Update Session State
    this.sessionStore.getState().setPlaying(false);
  }

  //current time은 스토어에 저장하지않는다. 너무 자주바뀜. 그리고 단일 진실원천 유지를위해 engine에서 받아온다.
  handleSeek(time: number): void {
    console.log(`[PlaybackController] Handling Seek Request: ${time}s`);
    this.audioEngine.seekTo(time);
  }

  getCurrentTime(): number {
    return this.audioEngine.getCurrentTime();
  }

  handleLoop(start: number, end: number, isLooping: boolean): void {
    if (isLooping) {
      console.log(`[PlaybackController] Set Loop: ${start} -> ${end}`);
      this.audioEngine.setLoopPoints(start, end);
      this.audioEngine.setLoop(true);
      this.sessionStore.getState().setLoopPoints(start, end);
      this.sessionStore.getState().setLoop(true);
    } else {
      console.log('[PlaybackController] Loop Off');
      this.audioEngine.setLoop(false);
      this.sessionStore.getState().setLoop(false);
    }
  }

  handleBpm(bpm: number): void {
    console.log(`[PlaybackController] Set BPM: ${bpm}`);
    this.audioEngine.setBpm(bpm);
    this.sessionStore.getState().setBpm(bpm);
  }

  handleMasterVolume(volume: number): void {
    console.log(`[PlaybackController] Set Master Volume: ${volume}`);
    this.audioEngine.setMasterVolume(volume);
    this.sessionStore.getState().setMasterVolume(volume);
  }
}
