/**
 * Transport - DAW의 트랜스포트 시스템
 * Ardour의 Transport 개념을 구현
 */
import { BEATS_PER_BAR } from '../../constants/audio';
import { TempoMap, type BBTTime } from './TempoMap';

export class Transport {
  private context: AudioContext;
  private bpm: number;
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private startPosition: number = 0;
  private tempoMap: TempoMap;

  constructor(context: AudioContext, bpm: number) {
    this.context = context;
    this.bpm = bpm;
    this.tempoMap = new TempoMap(bpm, { beatsPerBar: BEATS_PER_BAR, noteValue: 4 }, context.sampleRate);
  }

  /**
   * 재생 시작
   */
  play(): void {
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.startTime = this.context.currentTime;
      this.startPosition = this.pauseTime;
    }
  }

  /**
   * 재생 정지
   */
  stop(): void {
    this.isPlaying = false;
    this.startTime = 0;
    this.pauseTime = 0;
    this.startPosition = 0;
  }

  /**
   * 일시정지
   */
  pause(): void {
    if (this.isPlaying) {
      // 현재 위치를 먼저 계산 (isPlaying이 true일 때)
      const elapsed = this.context.currentTime - this.startTime;
      this.pauseTime = this.startPosition + elapsed;
      // 그 다음 재생 상태를 false로 변경
      this.isPlaying = false;
    }
  }

  /**
   * 재개
   */
  resume(): void {
    if (!this.isPlaying) {
      this.startTime = this.context.currentTime;
      this.startPosition = this.pauseTime;
      this.isPlaying = true;
    }
  }

  /**
   * 현재 재생 여부
   */
  isPlayingState(): boolean {
    return this.isPlaying;
  }

  /**
   * 현재 재생 위치 가져오기 (초 단위)
   */
  getPosition(): number {
    if (!this.isPlaying) {
      return this.pauseTime;
    }

    const elapsed = this.context.currentTime - this.startTime;
    return this.startPosition + elapsed;
  }

  /**
   * 재생 위치 설정
   */
  setPosition(position: number): void {
    if (this.isPlaying) {
      this.startTime = this.context.currentTime;
      this.startPosition = position;
    } else {
      this.pauseTime = position;
    }
  }

  /**
   * BPM 설정
   */
  setBPM(bpm: number): void {
    this.bpm = bpm;
    this.tempoMap.setBPM(bpm);
  }

  /**
   * BPM 가져오기
   */
  getBPM(): number {
    return this.bpm;
  }

  /**
   * 현재 재생 위치를 BBT 시간으로 가져오기
   * 
   * @returns BBT 시간 (Bar:Beat:Tick)
   */
  getBBTPosition(): BBTTime {
    const position = this.getPosition();
    return this.tempoMap.secondsToBBT(position);
  }

  /**
   * BBT 시간으로 재생 위치 설정
   * 
   * @param bbt BBT 시간
   */
  setBBTPosition(bbt: BBTTime): void {
    const seconds = this.tempoMap.bbtToSeconds(bbt);
    this.setPosition(seconds);
  }

  /**
   * 초를 마디:비트로 변환 (기존 호환성 유지)
   * @deprecated getBBTPosition() 사용 권장
   */
  secondsToBarsAndBeats(seconds: number): {
    bars: number;
    beats: number;
    beatsDecimal: number;
  } {
    const bbt = this.tempoMap.secondsToBBT(seconds);
    const beatsDecimal = bbt.beats - 1 + bbt.ticks / 1920;
    
    return {
      bars: bbt.bars - 1, // 0부터 시작하도록 변환 (기존 호환성)
      beats: bbt.beats - 1, // 0부터 시작하도록 변환
      beatsDecimal: beatsDecimal,
    };
  }

  /**
   * 마디:비트를 초로 변환 (기존 호환성 유지)
   * @deprecated bbtToSeconds() 사용 권장
   */
  barsAndBeatsToSeconds(bars: number, beats: number): number {
    // 0부터 시작하는 인덱스를 1부터 시작하는 BBT로 변환
    const bbt: BBTTime = {
      bars: bars + 1,
      beats: beats + 1,
      ticks: 0,
    };
    return this.tempoMap.bbtToSeconds(bbt);
  }

  /**
   * TempoMap 인스턴스 가져오기
   */
  getTempoMap(): TempoMap {
    return this.tempoMap;
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    this.stop();
  }
}
