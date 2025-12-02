/**
 * Timeline - 타임라인 타입 시스템
 * Ardour의 temporal/timeline.h를 참고하여 구현
 * 
 * timepos_t: 절대 위치 (AudioTime 또는 BeatTime)
 * timecnt_t: 시간 간격/지속시간 (위치 기반)
 */

import type { TempoMap } from '../audio/TempoMap';

/**
 * TimeDomain - 시간 도메인
 */
export enum TimeDomain {
  AudioTime = 'audio', // 샘플/초 기반
  BeatTime = 'beat',   // 비트/마디 기반
}

/**
 * timepos_t - 타임라인의 절대 위치
 * 
 * Ardour의 timepos_t와 동일한 개념:
 * - 항상 양수 (타임라인 원점부터의 거리)
 * - AudioTime 또는 BeatTime 도메인
 * - 도메인 간 변환은 TempoMap 사용
 */
export class TimePos {
  private value: number; // 초 또는 비트
  private domain: TimeDomain;

  constructor(value: number = 0, domain: TimeDomain = TimeDomain.AudioTime) {
    this.value = Math.max(0, value);
    this.domain = domain;
  }

  /**
   * AudioTime 도메인으로 생성
   */
  static fromSeconds(seconds: number): TimePos {
    return new TimePos(seconds, TimeDomain.AudioTime);
  }

  /**
   * BeatTime 도메인으로 생성
   */
  static fromBeats(beats: number): TimePos {
    return new TimePos(beats, TimeDomain.BeatTime);
  }

  /**
   * 샘플로부터 생성
   */
  static fromSamples(samples: number, sampleRate: number): TimePos {
    return TimePos.fromSeconds(samples / sampleRate);
  }

  /**
   * 영점 위치
   */
  static zero(domain: TimeDomain = TimeDomain.AudioTime): TimePos {
    return new TimePos(0, domain);
  }

  /**
   * 도메인 확인
   */
  isAudioTime(): boolean {
    return this.domain === TimeDomain.AudioTime;
  }

  isBeatTime(): boolean {
    return this.domain === TimeDomain.BeatTime;
  }

  getDomain(): TimeDomain {
    return this.domain;
  }

  /**
   * 값 가져오기
   */
  getValue(): number {
    return this.value;
  }

  /**
   * 초 단위로 가져오기 (도메인 변환 필요 시 TempoMap 사용)
   */
  toSeconds(tempoMap?: TempoMap): number {
    if (this.isAudioTime()) {
      return this.value;
    }
    // BeatTime -> AudioTime 변환
    if (tempoMap) {
      return tempoMap.beatsToSeconds(this.value);
    }
    // TempoMap이 없으면 근사치 (120 BPM 가정)
    return (this.value * 60) / 120;
  }

  /**
   * 비트 단위로 가져오기 (도메인 변환 필요 시 TempoMap 사용)
   */
  toBeats(tempoMap?: TempoMap): number {
    if (this.isBeatTime()) {
      return this.value;
    }
    // AudioTime -> BeatTime 변환
    if (tempoMap) {
      return tempoMap.secondsToBeats(this.value);
    }
    // TempoMap이 없으면 근사치 (120 BPM 가정)
    return (this.value * 120) / 60;
  }

  /**
   * 샘플로 변환
   */
  toSamples(sampleRate: number, tempoMap?: TempoMap): number {
    return Math.floor(this.toSeconds(tempoMap) * sampleRate);
  }

  /**
   * 도메인 변환
   */
  convertDomain(targetDomain: TimeDomain, tempoMap?: TempoMap): TimePos {
    if (this.domain === targetDomain) {
      return this;
    }

    if (targetDomain === TimeDomain.AudioTime) {
      return TimePos.fromSeconds(this.toSeconds(tempoMap));
    } else {
      return TimePos.fromBeats(this.toBeats(tempoMap));
    }
  }

  /**
   * 비교 연산자
   */
  equals(other: TimePos, tempoMap?: TempoMap): boolean {
    if (this.domain === other.domain) {
      return this.value === other.value;
    }
    // 도메인이 다르면 변환 후 비교
    return this.toSeconds(tempoMap) === other.toSeconds(tempoMap);
  }

  lessThan(other: TimePos, tempoMap?: TempoMap): boolean {
    if (this.domain === other.domain) {
      return this.value < other.value;
    }
    return this.toSeconds(tempoMap) < other.toSeconds(tempoMap);
  }

  greaterThan(other: TimePos, tempoMap?: TempoMap): boolean {
    if (this.domain === other.domain) {
      return this.value > other.value;
    }
    return this.toSeconds(tempoMap) > other.toSeconds(tempoMap);
  }

  /**
   * 거리 계산 (timecnt_t 반환)
   */
  distance(other: TimePos, tempoMap?: TempoMap): TimeCnt {
    const thisSeconds = this.toSeconds(tempoMap);
    const otherSeconds = other.toSeconds(tempoMap);
    const diff = otherSeconds - thisSeconds;
    return TimeCnt.fromSeconds(diff, this);
  }

  /**
   * 더하기
   */
  add(duration: TimeCnt, tempoMap?: TempoMap): TimePos {
    if (this.domain === duration.getDomain()) {
      return new TimePos(this.value + duration.getValue(), this.domain);
    }
    // 도메인이 다르면 AudioTime으로 변환 후 계산
    const thisSeconds = this.toSeconds(tempoMap);
    const durationSeconds = duration.toSeconds(tempoMap);
    return TimePos.fromSeconds(thisSeconds + durationSeconds);
  }

  /**
   * 빼기 (earlier)
   */
  earlier(duration: TimeCnt, tempoMap?: TempoMap): TimePos {
    if (this.domain === duration.getDomain()) {
      return new TimePos(Math.max(0, this.value - duration.getValue()), this.domain);
    }
    const thisSeconds = this.toSeconds(tempoMap);
    const durationSeconds = duration.toSeconds(tempoMap);
    return TimePos.fromSeconds(Math.max(0, thisSeconds - durationSeconds));
  }

  /**
   * 문자열 표현
   */
  toString(): string {
    if (this.isAudioTime()) {
      return `a${this.value}`;
    }
    return `b${this.value}`;
  }
}

/**
 * timecnt_t - 시간 간격/지속시간
 * 
 * Ardour의 timecnt_t와 동일한 개념:
 * - 위치 기반 지속시간
 * - AudioTime 또는 BeatTime 도메인
 * - 위치에 따라 실제 지속시간이 달라질 수 있음 (템포 변화)
 */
export class TimeCnt {
  private value: number; // 초 또는 비트
  private domain: TimeDomain;
  private position: TimePos; // 기준 위치

  constructor(
    value: number = 0,
    position: TimePos = TimePos.zero(),
    domain: TimeDomain = TimeDomain.AudioTime
  ) {
    this.value = value;
    this.position = position;
    this.domain = domain;
  }

  /**
   * AudioTime 도메인으로 생성
   */
  static fromSeconds(seconds: number, position: TimePos = TimePos.zero()): TimeCnt {
    return new TimeCnt(seconds, position, TimeDomain.AudioTime);
  }

  /**
   * BeatTime 도메인으로 생성
   */
  static fromBeats(beats: number, position: TimePos = TimePos.zero()): TimeCnt {
    return new TimeCnt(beats, position, TimeDomain.BeatTime);
  }

  /**
   * 샘플로부터 생성
   */
  static fromSamples(
    samples: number,
    sampleRate: number,
    position: TimePos = TimePos.zero()
  ): TimeCnt {
    return TimeCnt.fromSeconds(samples / sampleRate, position);
  }

  /**
   * 영점 지속시간
   */
  static zero(domain: TimeDomain = TimeDomain.AudioTime): TimeCnt {
    return new TimeCnt(0, TimePos.zero(domain), domain);
  }

  /**
   * 도메인 확인
   */
  isAudioTime(): boolean {
    return this.domain === TimeDomain.AudioTime;
  }

  isBeatTime(): boolean {
    return this.domain === TimeDomain.BeatTime;
  }

  getDomain(): TimeDomain {
    return this.domain;
  }

  /**
   * 값 가져오기
   */
  getValue(): number {
    return this.value;
  }

  /**
   * 기준 위치 가져오기
   */
  getPosition(): TimePos {
    return this.position;
  }

  /**
   * 초 단위로 가져오기 (위치 기반 변환)
   */
  toSeconds(tempoMap?: TempoMap): number {
    if (this.isAudioTime()) {
      return this.value;
    }
    // BeatTime -> AudioTime 변환 (위치 기반)
    if (tempoMap) {
      const positionSeconds = this.position.toSeconds(tempoMap);
      const beatsAtPosition = this.position.toBeats(tempoMap);
      const endBeats = beatsAtPosition + this.value;
      const endSeconds = tempoMap.beatsToSeconds(endBeats);
      return endSeconds - positionSeconds;
    }
    // TempoMap이 없으면 근사치
    return (this.value * 60) / 120;
  }

  /**
   * 비트 단위로 가져오기 (위치 기반 변환)
   */
  toBeats(tempoMap?: TempoMap): number {
    if (this.isBeatTime()) {
      return this.value;
    }
    // AudioTime -> BeatTime 변환 (위치 기반)
    if (tempoMap) {
      const positionSeconds = this.position.toSeconds(tempoMap);
      const endSeconds = positionSeconds + this.value;
      const positionBeats = this.position.toBeats(tempoMap);
      const endBeats = tempoMap.secondsToBeats(endSeconds);
      return endBeats - positionBeats;
    }
    // TempoMap이 없으면 근사치
    return (this.value * 120) / 60;
  }

  /**
   * 샘플로 변환
   */
  toSamples(sampleRate: number, tempoMap?: TempoMap): number {
    return Math.floor(this.toSeconds(tempoMap) * sampleRate);
  }

  /**
   * 종료 위치 계산
   */
  end(tempoMap?: TempoMap): TimePos {
    return this.position.add(this, tempoMap);
  }

  /**
   * 비교 연산자
   */
  equals(other: TimeCnt, tempoMap?: TempoMap): boolean {
    if (this.domain === other.domain && this.position.equals(other.position, tempoMap)) {
      return this.value === other.value;
    }
    return this.toSeconds(tempoMap) === other.toSeconds(tempoMap);
  }

  /**
   * 더하기
   */
  add(other: TimeCnt, tempoMap?: TempoMap): TimeCnt {
    if (this.domain === other.domain && this.position.equals(other.position, tempoMap)) {
      return new TimeCnt(this.value + other.value, this.position, this.domain);
    }
    // 도메인이 다르면 AudioTime으로 변환
    const thisSeconds = this.toSeconds(tempoMap);
    const otherSeconds = other.toSeconds(tempoMap);
    return TimeCnt.fromSeconds(thisSeconds + otherSeconds, this.position);
  }

  /**
   * 빼기
   */
  subtract(other: TimeCnt, tempoMap?: TempoMap): TimeCnt {
    if (this.domain === other.domain && this.position.equals(other.position, tempoMap)) {
      return new TimeCnt(Math.max(0, this.value - other.value), this.position, this.domain);
    }
    const thisSeconds = this.toSeconds(tempoMap);
    const otherSeconds = other.toSeconds(tempoMap);
    return TimeCnt.fromSeconds(Math.max(0, thisSeconds - otherSeconds), this.position);
  }

  /**
   * 스케일링
   */
  scale(factor: number): TimeCnt {
    return new TimeCnt(this.value * factor, this.position, this.domain);
  }

  /**
   * 절댓값
   */
  abs(): TimeCnt {
    return new TimeCnt(Math.abs(this.value), this.position, this.domain);
  }

  /**
   * 문자열 표현
   */
  toString(): string {
    const domainPrefix = this.isAudioTime() ? 'a' : 'b';
    return `${domainPrefix}${this.value}@${this.position.toString()}`;
  }
}


