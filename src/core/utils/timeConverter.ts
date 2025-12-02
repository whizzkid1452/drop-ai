/**
 * TimeConverter - 시간 변환 유틸리티
 * Ardour의 temporal 라이브러리를 참고하여 구현
 * 
 * 주요 기능:
 * - 초 ↔ BBT (Bar:Beat:Tick) 변환
 * - 초 ↔ 비트 변환
 * - 샘플 ↔ 시간 변환
 * - 시간 포맷팅 (시간코드, BBT 등)
 */

import type { TempoMap } from '../audio/TempoMap';

/**
 * BBT (Bar:Beat:Tick) 구조
 */
export interface BBT {
  bar: number;
  beat: number;
  tick: number;
}

/**
 * 시간 포맷 타입
 */
export type TimeFormat = 'seconds' | 'bbt' | 'beats' | 'samples' | 'timecode';

/**
 * TimeConverter 클래스
 * TempoMap과 통합하여 정확한 시간 변환 제공
 */
export class TimeConverter {
  private tempoMap: TempoMap;
  private sampleRate: number;

  constructor(tempoMap: TempoMap, sampleRate: number = 44100) {
    this.tempoMap = tempoMap;
    this.sampleRate = sampleRate;
  }

  /**
   * 초를 샘플로 변환
   * @param seconds 초
   * @returns 샘플 수
   */
  secondsToSamples(seconds: number): number {
    return Math.floor(seconds * this.sampleRate);
  }

  /**
   * 샘플을 초로 변환
   * @param samples 샘플 수
   * @returns 초
   */
  samplesToSeconds(samples: number): number {
    return samples / this.sampleRate;
  }

  /**
   * 초를 비트로 변환
   * @param seconds 초
   * @returns 비트 수
   */
  secondsToBeats(seconds: number): number {
    // TempoMap의 secondsToBeats 메서드 사용
    return this.tempoMap.secondsToBeats(seconds);
  }

  /**
   * 비트를 초로 변환
   * @param beats 비트 수
   * @returns 초
   */
  beatsToSeconds(beats: number): number {
    // TempoMap의 beatsToSeconds 메서드 사용
    return this.tempoMap.beatsToSeconds(beats);
  }

  /**
   * 초를 BBT로 변환
   * @param seconds 초
   * @returns BBT 구조
   */
  secondsToBBT(seconds: number): BBT {
    // TempoMap의 secondsToBBT 메서드 사용
    const bbtTime = this.tempoMap.secondsToBBT(seconds);
    return {
      bar: bbtTime.bars,
      beat: bbtTime.beats,
      tick: bbtTime.ticks,
    };
  }

  /**
   * BBT를 초로 변환
   * @param bbt BBT 구조
   * @returns 초
   */
  bbtToSeconds(bbt: BBT): number {
    // TempoMap의 bbtToSeconds 메서드 사용
    const bbtTime = {
      bars: bbt.bar,
      beats: bbt.beat,
      ticks: bbt.tick,
    };
    return this.tempoMap.bbtToSeconds(bbtTime);
  }

  /**
   * 샘플을 BBT로 변환
   * @param samples 샘플 수
   * @returns BBT 구조
   */
  samplesToBBT(samples: number): BBT {
    const seconds = this.samplesToSeconds(samples);
    return this.secondsToBBT(seconds);
  }

  /**
   * BBT를 샘플로 변환
   * @param bbt BBT 구조
   * @returns 샘플 수
   */
  bbtToSamples(bbt: BBT): number {
    const seconds = this.bbtToSeconds(bbt);
    return this.secondsToSamples(seconds);
  }

  /**
   * BBT를 문자열로 포맷팅
   * @param bbt BBT 구조
   * @returns 포맷된 문자열 (예: "1:1:0")
   */
  formatBBT(bbt: BBT): string {
    return `${bbt.bar}:${bbt.beat}:${bbt.tick}`;
  }

  /**
   * 초를 시간코드로 포맷팅 (HH:MM:SS.mmm)
   * @param seconds 초
   * @returns 시간코드 문자열
   */
  formatTimecode(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }

  /**
   * 초를 시간 문자열로 포맷팅 (MM:SS.mmm)
   * @param seconds 초
   * @returns 시간 문자열
   */
  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }

  /**
   * 초를 다양한 형식으로 포맷팅
   * @param seconds 초
   * @param format 포맷 타입
   * @returns 포맷된 문자열
   */
  format(seconds: number, format: TimeFormat): string {
    switch (format) {
      case 'seconds':
        return seconds.toFixed(3);
      case 'bbt':
        return this.formatBBT(this.secondsToBBT(seconds));
      case 'beats':
        return this.secondsToBeats(seconds).toFixed(2);
      case 'samples':
        return this.secondsToSamples(seconds).toString();
      case 'timecode':
        return this.formatTimecode(seconds);
      default:
        return seconds.toFixed(3);
    }
  }

  /**
   * 시간 문자열 파싱 (다양한 형식 지원)
   * @param timeString 시간 문자열
   * @param format 포맷 타입 (지정하지 않으면 자동 감지)
   * @returns 초
   */
  parse(timeString: string, format?: TimeFormat): number {
    if (format) {
      return this.parseWithFormat(timeString, format);
    }

    // 자동 감지
    if (timeString.includes(':')) {
      // BBT 또는 시간코드 형식
      const parts = timeString.split(':');
      if (parts.length === 3) {
        // BBT 형식 (Bar:Beat:Tick)
        const bbt: BBT = {
          bar: parseInt(parts[0], 10),
          beat: parseInt(parts[1], 10),
          tick: parseInt(parts[2], 10),
        };
        return this.bbtToSeconds(bbt);
      } else if (parts.length === 2) {
        // MM:SS 형식
        const minutes = parseInt(parts[0], 10);
        const seconds = parseFloat(parts[1]);
        return minutes * 60 + seconds;
      }
    }

    // 숫자로 파싱 시도
    const num = parseFloat(timeString);
    if (!isNaN(num)) {
      return num;
    }

    throw new Error(`시간 문자열을 파싱할 수 없습니다: ${timeString}`);
  }

  /**
   * 지정된 포맷으로 시간 문자열 파싱
   * @param timeString 시간 문자열
   * @param format 포맷 타입
   * @returns 초
   */
  private parseWithFormat(timeString: string, format: TimeFormat): number {
    switch (format) {
      case 'seconds':
        return parseFloat(timeString);
      case 'bbt': {
        const parts = timeString.split(':');
        if (parts.length !== 3) {
          throw new Error(`잘못된 BBT 형식: ${timeString}`);
        }
        const bbt: BBT = {
          bar: parseInt(parts[0], 10),
          beat: parseInt(parts[1], 10),
          tick: parseInt(parts[2], 10),
        };
        return this.bbtToSeconds(bbt);
      }
      case 'beats':
        return this.beatsToSeconds(parseFloat(timeString));
      case 'samples':
        return this.samplesToSeconds(parseInt(timeString, 10));
      case 'timecode': {
        const parts = timeString.split(':');
        if (parts.length !== 3) {
          throw new Error(`잘못된 시간코드 형식: ${timeString}`);
        }
        const [hours, minutes, secondsWithMs] = parts;
        const [seconds, milliseconds] = secondsWithMs.split('.');
        return (
          parseInt(hours, 10) * 3600 +
          parseInt(minutes, 10) * 60 +
          parseInt(seconds, 10) +
          (parseInt(milliseconds || '0', 10) / 1000)
        );
      }
      default:
        return parseFloat(timeString);
    }
  }

  /**
   * 샘플레이트 설정
   * @param sampleRate 샘플레이트
   */
  setSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
  }

  /**
   * TempoMap 업데이트
   * @param tempoMap 새로운 TempoMap
   */
  setTempoMap(tempoMap: TempoMap): void {
    this.tempoMap = tempoMap;
  }
}

/**
 * 유틸리티 함수: 초를 시간 문자열로 포맷팅
 */
export function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * 유틸리티 함수: BBT를 문자열로 포맷팅
 */
export function formatBBT(bbt: BBT): string {
  return `${bbt.bar}:${bbt.beat}:${bbt.tick}`;
}

