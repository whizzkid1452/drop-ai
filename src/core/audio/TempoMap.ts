/**
 * TempoMap - 템포 맵 및 BBT (Bar:Beat:Tick) 시간 변환
 *
 * 주요 기능:
 * - 템포 마커 추적 (시간에 따라 템포 변화)
 * - 미터(Time Signature) 마커 추적
 * - 특정 시점의 템포/미터 조회
 * - 초/비트/BBT 간 변환
 */

import { BEATS_PER_BAR, TICKS_PER_BEAT } from '../../constants/audio';

/**
 * BBT_Time - Bar:Beat:Tick 시간 표현
 */
export interface BBTTime {
  bars: number; // 마디 번호 (1부터 시작)
  beats: number; // 비트 번호 (1부터 시작)
  ticks: number; // 틱 (0 ~ TICKS_PER_BEAT-1)
}

/**
 * BBT_Offset - BBT 시간 오프셋 (bars/beats/ticks가 0일 수 있음)
 */
export interface BBTOffset {
  bars: number;
  beats: number;
  ticks: number;
}

/**
 * Tempo - 템포 정보
 */
export interface Tempo {
  bpm: number; // BPM (Beats Per Minute)
  noteType: number; // 노트 타입 (기본값: 4 = quarter note)
}

/**
 * Meter - 미터(Time Signature) 정보
 */
export interface Meter {
  beatsPerBar: number; // 마디당 비트 수
  noteValue: number; // 노트 값 (기본값: 4 = quarter note)
}

/**
 * TempoMetric - 특정 시점의 템포와 미터 조합
 */
export interface TempoMetric {
  tempo: Tempo;
  meter: Meter;
  referenceTime: number; // 초 단위 기준 시간
}

/**
 * TempoPoint - 템포 마커
 */
export interface TempoPoint {
  time: number; // 초 단위 시간
  tempo: Tempo;
}

/**
 * MeterPoint - 미터 마커
 */
export interface MeterPoint {
  time: number; // 초 단위 시간
  meter: Meter;
}

/**
 * TempoMap - 템포 맵 관리 및 시간 변환
 * Ardour의 TempoMap과 동일한 기능 제공
 */
export class TempoMap {
  private tempoPoints: TempoPoint[] = [];
  private meterPoints: MeterPoint[] = [];
  private sampleRate: number;

  /**
   * @param initialBPM 초기 BPM
   * @param initialMeter 초기 미터
   * @param sampleRate 샘플레이트
   */
  constructor(
    initialBPM: number = 120,
    initialMeter: Meter = { beatsPerBar: BEATS_PER_BAR, noteValue: 4 },
    sampleRate: number = 44100
  ) {
    this.sampleRate = sampleRate;

    // 초기 템포 마커 추가 (시간 0)
    this.tempoPoints.push({
      time: 0,
      tempo: { bpm: initialBPM, noteType: 4 },
    });

    // 초기 미터 마커 추가 (시간 0)
    this.meterPoints.push({
      time: 0,
      meter: initialMeter,
    });
  }

  /**
   * 특정 시점의 템포를 찾기
   */
  private findTempoAt(time: number): TempoPoint {
    // 시간순으로 정렬된 리스트에서 해당 시점 이하의 가장 최근 템포 마커 찾기
    let tempoPoint: TempoPoint | null = null;

    for (let i = this.tempoPoints.length - 1; i >= 0; i--) {
      if (this.tempoPoints[i].time <= time) {
        tempoPoint = this.tempoPoints[i];
        break;
      }
    }

    // 항상 최소 하나는 있어야 함 (초기 템포)
    return tempoPoint || this.tempoPoints[0];
  }

  /**
   * 특정 시점의 미터를 찾기
   */
  private findMeterAt(time: number): MeterPoint {
    // 시간순으로 정렬된 리스트에서 해당 시점 이하의 가장 최근 미터 마커 찾기
    let meterPoint: MeterPoint | null = null;

    for (let i = this.meterPoints.length - 1; i >= 0; i--) {
      if (this.meterPoints[i].time <= time) {
        meterPoint = this.meterPoints[i];
        break;
      }
    }

    // 항상 최소 하나는 있어야 함 (초기 미터)
    return meterPoint || this.meterPoints[0];
  }

  /**
   * 특정 시점의 TempoMetric 가져오기 (Ardour의 metric_at)
   */
  metricAt(time: number): TempoMetric {
    const tempoPoint = this.findTempoAt(time);
    const meterPoint = this.findMeterAt(time);

    // 기준 시간은 템포와 미터 중 더 이른 시간
    const referenceTime = Math.min(tempoPoint.time, meterPoint.time);

    return {
      tempo: tempoPoint.tempo,
      meter: meterPoint.meter,
      referenceTime: referenceTime,
    };
  }

  /**
   * 템포 설정 (특정 시점에 템포 마커 추가/수정)
   */
  setTempo(tempo: Tempo, time: number): void {
    // 기존 템포 마커가 해당 시점에 있는지 확인
    const existingIndex = this.tempoPoints.findIndex(tp => tp.time === time);

    if (existingIndex >= 0) {
      // 기존 마커 수정
      this.tempoPoints[existingIndex].tempo = tempo;
    } else {
      // 새 마커 추가
      this.tempoPoints.push({ time, tempo });
      // 시간순으로 정렬
      this.tempoPoints.sort((a, b) => a.time - b.time);
    }
  }

  /**
   * 미터 설정 (특정 시점에 미터 마커 추가/수정)
   */
  setMeter(meter: Meter, time: number): void {
    // 기존 미터 마커가 해당 시점에 있는지 확인
    const existingIndex = this.meterPoints.findIndex(mp => mp.time === time);

    if (existingIndex >= 0) {
      // 기존 마커 수정
      this.meterPoints[existingIndex].meter = meter;
    } else {
      // 새 마커 추가
      this.meterPoints.push({ time, meter });
      // 시간순으로 정렬
      this.meterPoints.sort((a, b) => a.time - b.time);
    }
  }

  /**
   * 특정 시점의 템포 가져오기
   */
  tempoAt(time: number): Tempo {
    return this.findTempoAt(time).tempo;
  }

  /**
   * 특정 시점의 미터 가져오기
   */
  meterAt(time: number): Meter {
    return this.findMeterAt(time).meter;
  }

  /**
   * 초를 BBT 시간으로 변환 (Ardour의 bbt_at)
   *
   * @param seconds 초 단위 시간
   * @returns BBT 시간
   */
  secondsToBBT(seconds: number): BBTTime {
    if (seconds < 0) {
      seconds = 0;
    }

    const metric = this.metricAt(seconds);

    // 기준 시간부터의 경과 시간 계산
    const elapsedTime = seconds - metric.referenceTime;

    // 기준 시간의 BBT 계산 (기준 시간이 0이면 1:1:0)
    let currentBBT: BBTTime;
    if (metric.referenceTime === 0) {
      currentBBT = { bars: 1, beats: 1, ticks: 0 };
    } else {
      // 기준 시간의 BBT를 재귀적으로 계산
      currentBBT = this.secondsToBBT(metric.referenceTime);
    }

    // 기준 시간부터 현재 시간까지의 비트 수 계산
    // 여러 템포 구간을 거쳐야 할 수 있음
    let remainingTime = elapsedTime;
    let currentTime = metric.referenceTime;
    let currentBars = currentBBT.bars;
    let currentBeats = currentBBT.beats;
    let currentTicks = currentBBT.ticks;

    while (remainingTime > 0) {
      // 현재 시점의 템포/미터 찾기
      const currentMetric = this.metricAt(currentTime);
      const currentTempo = currentMetric.tempo;
      const currentMeter = currentMetric.meter;

      // 다음 템포/미터 변화 시점 찾기
      const nextTempoChange = this.tempoPoints.find(
        tp => tp.time > currentTime
      );
      const nextMeterChange = this.meterPoints.find(
        mp => mp.time > currentTime
      );

      const nextChangeTime = Math.min(
        nextTempoChange?.time ?? Infinity,
        nextMeterChange?.time ?? Infinity,
        currentTime + remainingTime
      );

      // 현재 템포로 계산할 수 있는 시간 구간
      const segmentTime = Math.min(nextChangeTime - currentTime, remainingTime);

      // 비트 수 계산
      const beatsPerSecond = currentTempo.bpm / 60.0;
      const beatsInSegment = segmentTime * beatsPerSecond;

      // 틱으로 변환
      const ticksToAdd = Math.floor(beatsInSegment * TICKS_PER_BEAT);

      // BBT에 추가
      currentTicks += ticksToAdd;

      // 틱 오버플로우 처리
      while (currentTicks >= TICKS_PER_BEAT) {
        currentTicks -= TICKS_PER_BEAT;
        currentBeats += 1;
      }

      // 비트 오버플로우 처리
      while (currentBeats > currentMeter.beatsPerBar) {
        currentBeats -= currentMeter.beatsPerBar;
        currentBars += 1;
      }

      remainingTime -= segmentTime;
      currentTime += segmentTime;
    }

    return {
      bars: currentBars,
      beats: currentBeats,
      ticks: currentTicks,
    };
  }

  /**
   * BBT 시간을 초로 변환
   *
   * @param bbt BBT 시간
   * @returns 초 단위 시간
   */
  bbtToSeconds(bbt: BBTTime): number {
    // BBT를 비트로 변환한 후, 각 템포 구간에서 초로 변환
    // 이는 복잡한 계산이므로 이진 탐색 또는 근사치 사용

    // 간단한 방법: 초기 템포로 근사치 계산 후 정밀화
    const initialTempo = this.tempoPoints[0].tempo;
    const initialMeter = this.meterPoints[0].meter;

    // 총 비트 수 계산
    const bars = bbt.bars - 1;
    const beats = bbt.beats - 1;
    const totalBeats =
      bars * initialMeter.beatsPerBar + beats + bbt.ticks / TICKS_PER_BEAT;

    // 초기 근사치 (단일 템포 가정)
    let approximateSeconds = (totalBeats * 60.0) / initialTempo.bpm;

    // 정밀화: 실제 BBT와 비교하여 조정
    // 이진 탐색으로 정확한 시간 찾기
    let low = 0;
    let high = approximateSeconds * 2; // 안전한 상한
    let bestTime = approximateSeconds;
    let bestDiff = Infinity;

    for (let i = 0; i < 50; i++) {
      // 최대 50회 반복
      const testTime = (low + high) / 2;
      const testBBT = this.secondsToBBT(testTime);

      const diff = this.compareBBT(testBBT, bbt);

      if (Math.abs(diff) < bestDiff) {
        bestDiff = Math.abs(diff);
        bestTime = testTime;
      }

      if (diff < 0) {
        low = testTime;
      } else if (diff > 0) {
        high = testTime;
      } else {
        return testTime;
      }

      if (high - low < 0.0001) {
        break;
      }
    }

    return bestTime;
  }

  /**
   * BBT 비교 (a - b)
   */
  private compareBBT(a: BBTTime, b: BBTTime): number {
    if (a.bars !== b.bars) {
      return a.bars - b.bars;
    }
    if (a.beats !== b.beats) {
      return a.beats - b.beats;
    }
    return a.ticks - b.ticks;
  }

  /**
   * 초를 비트 수로 변환
   */
  secondsToBeats(seconds: number): number {
    // 여러 템포 구간을 거쳐야 할 수 있음
    let totalBeats = 0;
    let currentTime = 0;

    while (currentTime < seconds) {
      const metric = this.metricAt(currentTime);
      const tempo = metric.tempo;

      // 다음 템포 변화 시점 찾기
      const nextChange = this.tempoPoints.find(tp => tp.time > currentTime);
      const segmentEnd = Math.min(nextChange?.time ?? seconds, seconds);

      const segmentTime = segmentEnd - currentTime;
      const beatsPerSecond = tempo.bpm / 60.0;
      totalBeats += segmentTime * beatsPerSecond;

      currentTime = segmentEnd;
    }

    return totalBeats;
  }

  /**
   * 비트 수를 초로 변환
   */
  beatsToSeconds(beats: number): number {
    // 이진 탐색 사용
    let low = 0;
    let high = ((beats * 60) / this.tempoPoints[0].tempo.bpm) * 2; // 안전한 상한

    for (let i = 0; i < 50; i++) {
      const testTime = (low + high) / 2;
      const testBeats = this.secondsToBeats(testTime);

      const diff = testBeats - beats;

      if (Math.abs(diff) < 0.0001) {
        return testTime;
      }

      if (diff < 0) {
        low = testTime;
      } else {
        high = testTime;
      }

      if (high - low < 0.0001) {
        break;
      }
    }

    return (low + high) / 2;
  }

  /**
   * 샘플 위치를 BBT 시간으로 변환
   */
  samplesToBBT(samples: number): BBTTime {
    const seconds = samples / this.sampleRate;
    return this.secondsToBBT(seconds);
  }

  /**
   * BBT 시간을 샘플 위치로 변환
   */
  bbtToSamples(bbt: BBTTime): number {
    const seconds = this.bbtToSeconds(bbt);
    return Math.floor(seconds * this.sampleRate);
  }

  /**
   * BPM 설정 (전역, 시간 0의 템포 변경)
   */
  setBPM(bpm: number): void {
    this.setTempo({ bpm: Math.max(0.01, bpm), noteType: 4 }, 0);
  }

  /**
   * BPM 가져오기 (시간 0의 템포)
   */
  getBPM(): number {
    return this.tempoPoints[0].tempo.bpm;
  }

  /**
   * 마디당 비트 수 설정 (전역, 시간 0의 미터 변경)
   */
  setBeatsPerBar(beatsPerBar: number): void {
    const currentMeter = this.meterPoints[0].meter;
    this.setMeter(
      {
        beatsPerBar: Math.max(1, beatsPerBar),
        noteValue: currentMeter.noteValue,
      },
      0
    );
  }

  /**
   * 마디당 비트 수 가져오기 (시간 0의 미터)
   */
  getBeatsPerBar(): number {
    return this.meterPoints[0].meter.beatsPerBar;
  }

  /**
   * 샘플레이트 설정
   */
  setSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
  }

  /**
   * 샘플레이트 가져오기
   */
  getSampleRate(): number {
    return this.sampleRate;
  }

  /**
   * BBT 시간을 문자열로 포맷팅
   */
  formatBBT(bbt: BBTTime): string {
    const barsStr = String(bbt.bars).padStart(3, '0');
    const beatsStr = String(bbt.beats).padStart(2, '0');
    const ticksStr = String(bbt.ticks).padStart(4, '0');
    return `${barsStr}|${beatsStr}|${ticksStr}`;
  }

  /**
   * BBT 시간을 읽기 쉬운 문자열로 포맷팅
   */
  formatBBTReadable(bbt: BBTTime): string {
    return `${bbt.bars}:${bbt.beats}:${bbt.ticks}`;
  }

  /**
   * 모든 템포 마커 가져오기
   */
  getTempoPoints(): readonly TempoPoint[] {
    return this.tempoPoints;
  }

  /**
   * 모든 미터 마커 가져오기
   */
  getMeterPoints(): readonly MeterPoint[] {
    return this.meterPoints;
  }
}
