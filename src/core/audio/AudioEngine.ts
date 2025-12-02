import { Metronome } from './Metronome';
import { Transport } from './Transport';
import { Track } from './Track';
import { Bus } from './Bus';
import { Graph } from './Graph';
import { BufferManager } from './BufferManager';
import type { AudioEngineConfig } from '../../types/audio';
import { DEFAULT_ENGINE_CONFIG } from '../../constants/audio';

/**
 * AudioEngine - DAW의 핵심 오디오 처리 엔진
 * Ardour의 Mixer 개념을 Web Audio API로 구현
 */
export class AudioEngine {
  private context: AudioContext;
  private masterBus: Bus; // Master Bus (Ardour 스타일)
  private graph: Graph; // 오디오 라우팅 그래프
  private metronome: Metronome;
  private transport: Transport;
  private tracks: Track[] = [];
  private config: Required<AudioEngineConfig>;

  constructor(config: AudioEngineConfig = {}) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };

    // AudioContext 초기화
    this.context = new AudioContext({
      sampleRate: this.config.sampleRate,
      latencyHint: 'interactive',
    });

    // Master Bus 생성 (Ardour의 MasterOut 개념)
    this.masterBus = new Bus(this.context, 'Master');
    this.masterBus.setVolume(this.config.masterVolume);
    // Master Bus를 AudioContext의 destination에 연결
    this.masterBus.connect(this.context.destination);

    // Graph 시스템 초기화
    this.graph = new Graph();
    this.graph.addRoute(this.masterBus);

    // Transport 시스템 초기화
    this.transport = new Transport(this.context, this.config.bpm);

    // Metronome 초기화
    this.metronome = new Metronome(this.context, this.config.bpm);
    // 연결은 나중에 초기화가 완료될 때 수행
  }

  /**
   * AudioContext 가져오기
   */
  getAudioContext(): AudioContext {
    return this.context;
  }

  /**
   * Master Bus 가져오기
   */
  getMasterBus(): Bus {
    return this.masterBus;
  }

  /**
   * Transport 시스템 가져오기
   */
  getTransport(): Transport {
    return this.transport;
  }

  /**
   * 메트로놈 가져오기
   */
  getMetronome(): Metronome {
    return this.metronome;
  }

  /**
   * 재생 시작
   */
  async play(): Promise<void> {
    // AudioContext가 suspended 상태이면 resume
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    // AudioWorklet 초기화 및 연결
    if (!this.metronome.getIsReady()) {
      // Metronome을 Master Bus에 연결
      await this.metronome.connect(this.masterBus.getGainNode());
    }

    // 메트로놈 활성화
    await this.metronome.setEnabled(true);

    // Transport 재생 시작
    this.transport.play();

    // 모든 트랙 재생 시작
    const currentTime = this.context.currentTime;
    this.tracks.forEach(track => {
      track.play(this.context, currentTime, this.transport.getPosition());
    });
  }

  /**
   * 재생 정지
   */
  stop(): void {
    this.transport.stop();
    this.metronome.setEnabled(false);
    this.tracks.forEach(track => track.stop());
  }

  /**
   * 일시정지/재개
   */
  async togglePause(): Promise<void> {
    if (this.transport.isPlayingState()) {
      // 일시정지: 현재 transport position을 가져와서 전달
      const transportPosition = this.transport.getPosition();
      this.transport.pause();
      await this.metronome.setEnabled(false);
      this.tracks.forEach(track => track.pause(transportPosition));
    } else {
      // 재개
      this.transport.resume();
      await this.metronome.setEnabled(true);
      const currentTime = this.context.currentTime;
      this.tracks.forEach(track => {
        track.resume(this.context, currentTime);
      });
    }
  }

  /**
   * Graph 시스템 가져오기
   */
  getGraph(): Graph {
    return this.graph;
  }

  /**
   * 트랙 추가
   */
  addTrack(name: string = `Track ${this.tracks.length + 1}`): Track {
    const track = new Track(this.context, name, this.tracks.length);
    
    // Graph에 Track 추가
    this.graph.addRoute(track);
    
    // Track을 Master Bus에 연결 (의존성 추가)
    this.graph.addConnection(track, this.masterBus);
    
    // 실제 오디오 연결
    track.connect(this.masterBus.getGainNode());
    
    this.tracks.push(track);
    return track;
  }

  /**
   * 트랙 제거
   */
  removeTrack(track: Track): void {
    const index = this.tracks.indexOf(track);
    if (index > -1) {
      // 재생 중이면 먼저 정지 (Clip 정리)
      if (this.transport.isPlayingState()) {
        track.stop();
      }
      
      // Graph에서 연결 제거
      this.graph.removeConnection(track, this.masterBus);
      this.graph.removeRoute(track);
      
      // 실제 오디오 연결 해제
      track.disconnect();
      this.tracks.splice(index, 1);
    }
  }

  /**
   * Solo 상태에 따라 각 트랙의 mute override를 재계산
   */
  recomputeSoloMute(): void {
    const anySolo = this.tracks.some(t => t.isSoloState());
    if (anySolo) {
      this.tracks.forEach(t => t.setMuteOverride(!t.isSoloState()));
    } else {
      this.tracks.forEach(t => t.setMuteOverride(false));
    }
  }

  /**
   * 모든 트랙 가져오기
   */
  getTracks(): Track[] {
    return this.tracks;
  }

  /**
   * 오디오 파일 로드
   * BufferManager 캐시를 활용하여 중복 로드 방지
   */
  async loadAudioFile(file: File): Promise<AudioBuffer> {
    // 파일 ID 생성 (파일명 + 크기 + 수정 시간)
    const sourceId = `${file.name}_${file.size}_${file.lastModified}`;
    
    // BufferManager 캐시에서 확인
    const cached = BufferManager.getCachedBuffer(sourceId, this.context);
    if (cached) {
      return cached;
    }

    // 캐시에 없으면 로드
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await this.context.decodeAudioData(arrayBuffer);
    
    // BufferManager에 캐싱
    BufferManager.cacheBuffer(sourceId, buffer);
    
    return buffer;
  }

  /**
   * BPM 설정
   */
  setBPM(bpm: number): void {
    this.config.bpm = bpm;
    this.transport.setBPM(bpm);
    this.metronome.setBPM(bpm);
  }

  /**
   * BPM 가져오기
   */
  getBPM(): number {
    return this.config.bpm;
  }

  /**
   * 마스터 볼륨 설정 (0-100)
   */
  setMasterVolume(volume: number): void {
    this.config.masterVolume = volume;
    this.masterBus.setVolume(volume);
  }

  /**
   * 마스터 볼륨 가져오기
   */
  getMasterVolume(): number {
    return this.masterBus.getVolume();
  }

  /**
   * 현재 재생 위치 가져오기
   */
  getPosition(): number {
    return this.transport.getPosition();
  }

  /**
   * 재생 위치 설정
   */
  setPosition(position: number): void {
    this.transport.setPosition(position);
    // 모든 트랙의 재생 위치 업데이트
    this.tracks.forEach(track => {
      track.updatePosition(position);
    });
  }

  /**
   * 현재 재생 상태 가져오기
   */
  isPlaying(): boolean {
    return this.transport.isPlayingState();
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    this.stop();
    this.tracks.forEach(track => track.dispose());
    this.tracks = [];
    this.metronome.dispose();
    this.transport.dispose();
    this.context.close();
  }
}
