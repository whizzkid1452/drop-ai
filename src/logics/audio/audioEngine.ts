import * as Tone from 'tone';
import {
  AudioCommandType,
  type AudioCommand,
} from '@/types/audioCommand.schema';
import { exportProject } from './exportProject';
import type {
  AudioEngineDependencies,
  TrackData,
} from './audioEngine.types';
import {
  AudioEngineError,
  AudioEngineErrorCode,
} from './audioEngine.errors';
import {
  PLAYER_CONFIG,
  configurePlayerLoop,
  startPlayer,
} from './playerConfig';

/**
 * AudioEngine (Singleton + Dependency Injection)
 * 
 * 개선 사항:
 * - ✅ 싱글톤 패턴: 단일 인스턴스 보장
 * - ✅ 의존성 주입: Store 직접 접근 제거
 * - ✅ 타입 안정성: any 타입 제거
 * - ✅ 에러 처리: 커스텀 에러 클래스 사용
 * - ✅ 코드 중복 제거: 공통 로직 추출
 * - ✅ 테스트 가능: resetInstance()로 격리
 * 
 * 역할:
 * - Tone.js 기능 래핑
 * - 트랙(Channels) 및 리전(Players) 관리
 * - Gateway 패턴으로 모든 오디오 명령 처리
 * 
 * 사용법:
 * ```typescript
 * // 앱 시작 시 한 번만 초기화
 * AudioEngine.initialize(dependencies);
 * 
 * // 이후 어디서든 사용
 * const engine = AudioEngine.getInstance();
 * await engine.execute({ type: 'PLAY' });
 * ```
 */
export class AudioEngine {
  private static instance: AudioEngine | null = null;
  private tracks: Map<string, TrackData> = new Map();

  /**
   * private 생성자 - 외부에서 직접 인스턴스 생성 불가
   * @param deps - AudioEngine이 필요로 하는 외부 의존성
   */
  private constructor(private deps: AudioEngineDependencies) { }

  /**
   * 싱글톤 인스턴스 초기화
   * 
   * 앱 시작 시 한 번만 호출해야 합니다.
   * 이미 초기화된 경우 기존 인스턴스를 반환합니다.
   * 
   * @param deps - AudioEngine 의존성
   * @returns AudioEngine 인스턴스
   */
  public static initialize(deps: AudioEngineDependencies): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine(deps);
      console.log('[AudioEngine] Initialized with dependencies');
    }
    return AudioEngine.instance;
  }

  /**
   * 초기화된 싱글톤 인스턴스 가져오기
   * 
   * initialize()가 먼저 호출되어야 합니다.
   * 
   * @returns AudioEngine 인스턴스
   * @throws {Error} 초기화되지 않은 경우
   */
  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      throw new Error(
        'AudioEngine not initialized. Call AudioEngine.initialize() first.'
      );
    }
    return AudioEngine.instance;
  }

  /**
   * 인스턴스 리셋 (테스트용)
   * 
   * 프로덕션 코드에서는 사용하지 마세요.
   * 주로 단위 테스트에서 테스트 간 격리를 위해 사용합니다.
   */
  public static resetInstance(): void {
    AudioEngine.instance = null;
    console.log('[AudioEngine] Instance reset');
  }

  /**
   * Gateway for all Audio Commands
   * 
   * @param command - 실행할 오디오 명령
   * @returns 명령 실행 결과 (타입 안정성 확보)
   */
  public async execute(command: AudioCommand): Promise<any> {
    try {
      switch (command.type) {
        case AudioCommandType.PLAY:
          return await this.handlePlay();

        case AudioCommandType.PAUSE:
          return this.handlePause();

        case AudioCommandType.STOP:
          return this.handleStop();

        case AudioCommandType.SET_TRACK_VOLUME:
          return this.handleSetTrackVolume(command.trackId, command.volume);

        case AudioCommandType.SET_TRACK_PAN:
          return this.handleSetTrackPan(command.trackId, command.pan);

        case AudioCommandType.LOAD_REGION:
          return await this.loadRegion(
            command.trackId,
            command.regionId,
            command.url,
            command.startTime,
            command.startOffset,
            command.duration
          );

        case AudioCommandType.UNLOAD_REGION:
          this.unloadRegion(command.trackId, command.regionId);
          return true;

        case AudioCommandType.GET_TRACK_INFO:
          return this.getTrackInfo();

        case AudioCommandType.SET_CURRENT_TIME:
          return this.handleSetCurrentTime(command.time);

        case AudioCommandType.SET_EXPORT_RANGE:
          return this.handleSetExportRange(command.startTime, command.endTime);

        case AudioCommandType.CLEAR_EXPORT_RANGE:
          return this.handleClearExportRange();

        case AudioCommandType.EXPORT_AUDIO:
          return await this.handleExportAudio();

        default:
          throw new AudioEngineError(
            AudioEngineErrorCode.CONTEXT_ERROR,
            `Unknown command type`
          );
      }
    } catch (error) {
      // AudioEngineError는 그대로 전달
      if (error instanceof AudioEngineError) {
        throw error;
      }

      // 기타 에러는 래핑
      throw new AudioEngineError(
        AudioEngineErrorCode.CONTEXT_ERROR,
        error instanceof Error ? error.message : 'Unknown error occurred',
        { originalError: error }
      );
    }
  }

  /**
   * 재생 처리
   */
  private async handlePlay(): Promise<boolean> {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    await Tone.getTransport().start();
    this.deps.updatePlaybackState({ isPlaying: true });
    return true;
  }

  /**
   * 일시정지 처리
   */
  private handlePause(): boolean {
    Tone.getTransport().pause();
    this.deps.updatePlaybackState({ isPlaying: false });
    return true;
  }

  /**
   * 정지 처리
   */
  private handleStop(): boolean {
    Tone.getTransport().stop();
    this.deps.updatePlaybackState({ isPlaying: false, currentTime: 0 });
    return true;
  }

  /**
   * 트랙 볼륨 설정 처리
   */
  private handleSetTrackVolume(trackId: string, volume: number): boolean {
    this.setTrackVolume(trackId, volume);
    this.deps.updateTrack(trackId, { volume });
    return true;
  }

  /**
   * 트랙 팬 설정 처리
   */
  private handleSetTrackPan(trackId: string, pan: number): boolean {
    this.setTrackPan(trackId, pan);
    this.deps.updateTrack(trackId, { pan });
    return true;
  }

  /**
   * 현재 시간 설정 처리
   */
  private handleSetCurrentTime(time: number): number {
    Tone.getTransport().seconds = time;
    this.deps.updatePlaybackState({ currentTime: time });
    return time;
  }

  /**
   * Export 범위 설정 처리
   */
  private handleSetExportRange(
    startTime: number,
    endTime: number
  ): { startTime: number; endTime: number } {
    this.deps.setExportRange(startTime, endTime);
    return { startTime, endTime };
  }

  /**
   * Export 범위 클리어 처리
   */
  private handleClearExportRange(): boolean {
    this.deps.setExportRange(null, null);
    return true;
  }

  /**
   * 오디오 내보내기 처리
   */
  private async handleExportAudio(): Promise<Blob> {
    const tracks = this.deps.getTracks();
    const range = this.deps.getExportRange();

    return await exportProject(tracks, range ?? undefined);
  }

  /**
   * 트랙 정보 가져오기
   */
  private getTrackInfo(): [string, import('@/types/track').Track][] {
    const tracks = this.deps.getTracks();
    return tracks.map(track => [track.id, track] as [string, import('@/types/track').Track]);
  }

  /**
   * 트랙 가져오기 또는 초기화
   * 
   * 목적: 코드 중복 제거
   * - setTrackVolume과 setTrackPan에서 반복되는 패턴 추출
   */
  private getOrInitTrack(trackId: string): TrackData {
    let track = this.tracks.get(trackId);

    if (!track) {
      this.initTrack(trackId);
      track = this.tracks.get(trackId);
    }

    if (!track) {
      throw new AudioEngineError(
        AudioEngineErrorCode.TRACK_INIT_FAILED,
        `Failed to initialize track: ${trackId}`,
        { trackId }
      );
    }

    return track;
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

  /**
   * 리전 로드
   * 
   * @param trackId - 트랙 ID
   * @param regionId - 리전 ID
   * @param url - 오디오 파일 URL
   * @param startTime - 타임라인에서 시작 시간
   * @param startOffset - 소스 파일에서 시작 오프셋
   * @param duration - 재생 지속 시간
   */
  private async loadRegion(
    trackId: string,
    regionId: string,
    url: string,
    startTime: number = 0,
    startOffset: number = 0,
    duration?: number
  ): Promise<boolean> {
    this.initTrack(trackId);
    const trackData = this.tracks.get(trackId);

    if (!trackData) {
      throw new AudioEngineError(
        AudioEngineErrorCode.TRACK_NOT_FOUND,
        `Track not found: ${trackId}`,
        { trackId }
      );
    }

    // 이미 로드된 리전은 스킵
    if (trackData.players.has(regionId)) {
      return true;
    }

    // CRITICAL: Promise로 래핑하여 sync().start() 완료 보장
    try {
      await new Promise<void>((resolve, reject) => {
        const player = new Tone.Player({
          url,
          loop: false,
          ...PLAYER_CONFIG,  // ✅ 공통 설정 (fadeIn, fadeOut)
          onload: () => {
            try {
              /**
                * ✅ CRITICAL: loopEnd를 설정하여 정확한 구간만 재생
                * 
                * AudioEngine과 exportProject 공통 로직:
                * - Tone.Player는 loop가 false여도 loopEnd를 존중합니다.
                * - 이를 통해 Split된 Region이 정확한 길이만큼만 재생됩니다.
                * - loopStart/loopEnd로 재생 구간을 명시적으로 제한합니다.
                * 
                * 참고: playerConfig.ts의 공통 함수로 관리됩니다.
                */
              if (duration !== undefined) {
                // ✅ 공통 함수로 loopStart/loopEnd 설정
                configurePlayerLoop(player, startOffset, duration);

                console.log(
                  `[AudioEngine] Region ${regionId}: loopStart=${player.loopStart}s, loopEnd=${player.loopEnd}s (duration=${duration}s)`,
                  {
                    audioFileLength: player.buffer.duration,
                    willPlay: `${startOffset}s ~ ${startOffset + duration}s`,
                  }
                );
              }

              // ✅ 공통 함수로 Player 시작 (Transport 동기화 모드)
              const playDuration = duration !== undefined ? duration : undefined;
              startPlayer({
                player,
                syncMode: true,
                startTime,
                startOffset,
                duration: playDuration,
              });

              console.log(
                `[AudioEngine] Loaded region ${regionId} at timeline ${startTime}s with offset ${startOffset}s, duration ${duration}s`,
                {
                  channelInputs: trackData.channel.numberOfInputs,
                  playerVolume: player.volume.value,
                  loopStart: player.loopStart,
                  loopEnd: player.loopEnd,
                }
              );

              resolve();
            } catch (error: unknown) {
              console.error(`[AudioEngine] Failed to sync region ${regionId}:`, error);
              reject(error);
            }
          },
          onerror: (error: unknown) => {
            console.error(`[AudioEngine] Failed to load region ${regionId}:`, error);
            reject(error);
          },
        }).connect(trackData.channel);

        trackData.players.set(regionId, player);
        console.log(
          `[AudioEngine] Player created for region ${regionId}, total players: ${trackData.players.size}`
        );
      });

      return true;
    } catch (error) {
      throw new AudioEngineError(
        AudioEngineErrorCode.REGION_LOAD_FAILED,
        `Failed to load region ${regionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { trackId, regionId, url, error }
      );
    }
  }

  /**
   * 리전 언로드
   * 
   * @param trackId - 트랙 ID
   * @param regionId - 리전 ID
   */
  private unloadRegion(trackId: string, regionId: string): void {
    const trackData = this.tracks.get(trackId);
    if (!trackData) return;

    const player = trackData.players.get(regionId);
    if (player) {
      console.log(`[AudioEngine] Unloading region ${regionId}:`, {
        state: player.state,
        loaded: player.loaded,
        volume: player.volume.value,
      });

      // CRITICAL: Proper cleanup order
      player.unsync(); // Remove from Transport
      player.stop(); // Stop playback
      player.disconnect(); // Disconnect from Channel
      player.dispose(); // Free resources

      trackData.players.delete(regionId);
      console.log(
        `[AudioEngine] Unloaded region ${regionId}, remaining players: ${trackData.players.size}`
      );
    }
  }

  /**
   * 트랙 볼륨 설정
   * 
   * @param trackId - 트랙 ID
   * @param volume - 선형 볼륨 (0.0 ~ 1.0)
   */
  private setTrackVolume(trackId: string, volume: number): void {
    const track = this.getOrInitTrack(trackId);
    const volumeInDb = Tone.gainToDb(volume);
    track.channel.volume.rampTo(volumeInDb, 0.1);
  }

  /**
   * 트랙 팬 설정
   * 
   * @param trackId - 트랙 ID
   * @param pan - 팬 값 (-1.0: 왼쪽 ~ 1.0: 오른쪽)
   */
  private setTrackPan(trackId: string, pan: number): void {
    const track = this.getOrInitTrack(trackId);
    track.channel.pan.rampTo(pan, 0.1);
  }
  /**
   * 현재 트랙 파라미터 가져오기 (Volume, Pan)
   * 
   * Export 시 실제 엔진 상태를 가져오기 위한 Source of Truth
   * 
   * @param trackId - 트랙 ID
   * @returns 볼륨(dB)과 팬 값, 트랙이 없으면 null
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
   * 현재 재생 시간 가져오기
   * 
   * @returns 현재 Transport 시간 (초)
   */
  public getSeconds(): number {
    return Tone.getTransport().seconds;
  }
}
