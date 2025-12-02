/**
 * Ruler Metric - 룰러 표시 전략
 * Ardour의 Ruler::Metric 패턴을 참고하여 구현
 *
 * 각 Metric은 특정 시간 표시 방식(Timecode, BBT, Samples, MinSec)을 구현
 */

/**
 * Ruler Mark - 룰러 마크
 */
export interface RulerMark {
  position: number; // 초 단위 위치
  label: string; // 표시할 텍스트
  style: 'major' | 'minor' | 'micro'; // 마크 스타일
}

/**
 * Metric - 룰러 메트릭 인터페이스
 */
export interface Metric {
  /**
   * 픽셀당 단위 (초)
   */
  unitsPerPixel: number;

  /**
   * 마크 생성
   * @param lower 하한 (초)
   * @param upper 상한 (초)
   * @param maxChars 최대 문자 수 (레이블 길이 제한) - TODO: 향후 레이블 겹침 방지에 사용
   * @param contentWidth 전체 컨텐츠 너비 (픽셀) - 매우 긴 시간 범위에서 마크 개수 계산에 사용
   */
  getMarks(
    lower: number,
    upper: number,
    maxChars: number,
    contentWidth?: number
  ): RulerMark[];
}

/**
 * BBT Metric - Bar:Beat:Tick 표시
 * Ardour의 compute_bbt_ruler_scale 방식 구현
 */
export class BBTMetric implements Metric {
  unitsPerPixel: number = 0;
  private tempoMap: any; // TempoMap 타입
  private sampleRate: number = 44100;

  // Ardour의 BBTRulerScale enum
  private bbtRulerScale: BBTRulerScale = BBTRulerScale.SHOW_MANY;
  private bbtBars: number = 0;
  // bbtBarHelperOn은 향후 bar helper 표시에 사용될 예정
  private bbtBarHelperOn: boolean = false;

  /**
   * Bar helper 표시 여부 가져오기 (향후 사용 예정)
   */
  getBarHelperOn(): boolean {
    return this.bbtBarHelperOn;
  }

  constructor(tempoMap: any, sampleRate: number = 44100) {
    this.tempoMap = tempoMap;
    this.sampleRate = sampleRate;
  }

  /**
   * Bar 개수 계산 (Ardour의 count_bars)
   * @param startBeats 시작 비트 수
   * @param endBeats 끝 비트 수
   * @returns bar 개수
   */
  private countBars(startBeats: number, endBeats: number): number {
    if (endBeats <= startBeats) return 0;

    // bar 그리드 포인트 계산
    // 각 bar의 시작 지점을 찾아서 개수 계산
    const beatsPerBar = this.tempoMap.getBeatsPerBar();

    // 시작 bar와 끝 bar 계산
    const startBar = Math.floor(startBeats / beatsPerBar);
    const endBar = Math.ceil(endBeats / beatsPerBar);

    return Math.max(0, endBar - startBar);
  }

  /**
   * Beats를 정수 비트로 반올림 (round_down_to_beat)
   */
  private roundDownToBeat(beats: number): number {
    return Math.floor(beats);
  }

  /**
   * Beats를 정수 비트로 올림 (round_up_to_beat)
   */
  private roundUpToBeat(beats: number): number {
    return Math.ceil(beats);
  }

  /**
   * BBT Ruler 스케일 계산 (Ardour의 compute_bbt_ruler_scale)
   * @param lowerSeconds 하한 (초)
   * @param upperSeconds 상한 (초)
   * @param contentWidth 컨텐츠 너비 (픽셀) - 선택적
   */
  private computeBBTRulerScale(
    lowerSeconds: number,
    upperSeconds: number,
    contentWidth?: number
  ): void {
    // 초를 샘플로 변환 (Ardour: samplepos_t lower, upper)
    const lowerSamples = Math.floor(lowerSeconds * this.sampleRate);
    const upperSamples = Math.ceil(upperSeconds * this.sampleRate);

    // 샘플을 Beats로 변환 (Ardour: quarters_at_sample)
    const lowerBeats = this.tempoMap.secondsToBeats(lowerSeconds);
    const upperBeats = this.tempoMap.secondsToBeats(upperSeconds);

    // Beats를 정수 비트로 반올림 (Ardour: round_down_to_beat, round_up_to_beat)
    let floorLowerBeat = Math.max(0, this.roundDownToBeat(lowerBeats));

    // Ardour: ceil_upper_beat = round_up_to_beat(upper) + Beats(1, 0)
    const ceilUpperBeat = this.roundUpToBeat(upperBeats) + 1;

    if (ceilUpperBeat <= floorLowerBeat) {
      this.bbtBars = 0;
      this.bbtRulerScale = BBTRulerScale.SHOW_MANY;
      return;
    }

    // Bar 개수 계산
    this.bbtBars = this.countBars(floorLowerBeat, ceilUpperBeat);

    // Beat 개수 계산 (Ardour: (ceil_upper_beat - floor_lower_beat).get_beats())
    // get_beats()는 정수 비트 수를 반환
    const beats = Math.floor(ceilUpperBeat - floorLowerBeat);

    // Beat density 계산 (Ardour 방식)
    // Ardour: ruler_line_granularity = visible_canvas_width() / (ruler_line_granularity*5)
    // ruler_line_granularity는 픽셀 단위 (기본값 5픽셀, UIConfiguration에서 가져옴)
    const rulerLineGranularityPixels = 5; // 기본값 (UIConfiguration.get_ruler_granularity())
    const visibleCanvasWidth = contentWidth ?? 1000; // 기본값
    const rulerLineGranularity =
      visibleCanvasWidth / (rulerLineGranularityPixels * 5);

    // 샘플 위치 계산 (Ardour: sample_at(floor_lower_beat), sample_at(ceil_upper_beat))
    const beatBeforeLowerPos = this.tempoMap.beatsToSeconds(floorLowerBeat);
    const beatAfterUpperPos = this.tempoMap.beatsToSeconds(ceilUpperBeat);
    const beatBeforeLowerSamples = Math.floor(
      beatBeforeLowerPos * this.sampleRate
    );
    const beatAfterUpperSamples = Math.ceil(
      beatAfterUpperPos * this.sampleRate
    );

    // Beat density 계산
    // Ardour: beat_density = ((beats + 1) * ((upper - lower) / (1 + beat_after_upper_pos - beat_before_lower_pos))) / ruler_line_granularity
    // 여기서 upper, lower, beat_after_upper_pos, beat_before_lower_pos는 모두 샘플 단위
    const sampleRange = upperSamples - lowerSamples;
    const beatSampleRange = beatAfterUpperSamples - beatBeforeLowerSamples;

    // beatSampleRange가 0이거나 너무 작으면 안전한 기본값 사용
    const safeBeatSampleRange = Math.max(1, beatSampleRange);
    const sampleRatio = sampleRange / (1 + safeBeatSampleRange);

    // rulerLineGranularity가 0이면 안전한 기본값 사용
    const safeRulerLineGranularity = Math.max(1, rulerLineGranularity);

    const beatDensity = ((beats + 1) * sampleRatio) / safeRulerLineGranularity;

    // 디버깅: beatDensity가 비정상적으로 크면 로그 출력
    if (beatDensity > 2048) {
      console.warn('BBT Ruler: beatDensity too high', {
        beatDensity,
        beats,
        sampleRange,
        beatSampleRange: safeBeatSampleRange,
        rulerLineGranularity: safeRulerLineGranularity,
        contentWidth,
        bbtBars: this.bbtBars,
      });
    }

    // Bar helper 표시 여부 결정 (향후 사용 예정)
    this.bbtBarHelperOn = this.bbtBars < 2 || beats < 5;

    // Beat density에 따라 스케일 결정
    // beatDensity가 비정상적으로 크면 bar 개수 기반으로 fallback
    if (beatDensity > 2048 || !isFinite(beatDensity)) {
      // Fallback: bar 개수 기반으로 스케일 결정
      if (this.bbtBars > 128) {
        this.bbtRulerScale = BBTRulerScale.SHOW_64;
      } else if (this.bbtBars > 32) {
        this.bbtRulerScale = BBTRulerScale.SHOW_16;
      } else if (this.bbtBars > 8) {
        this.bbtRulerScale = BBTRulerScale.SHOW_4;
      } else if (this.bbtBars > 2) {
        this.bbtRulerScale = BBTRulerScale.SHOW_1;
      } else {
        this.bbtRulerScale = BBTRulerScale.SHOW_QUARTERS;
      }
    } else if (beatDensity > 1024) {
      this.bbtRulerScale = BBTRulerScale.SHOW_64;
    } else if (beatDensity > 256) {
      this.bbtRulerScale = BBTRulerScale.SHOW_16;
    } else if (beatDensity > 64) {
      this.bbtRulerScale = BBTRulerScale.SHOW_4;
    } else if (beatDensity > 16) {
      this.bbtRulerScale = BBTRulerScale.SHOW_QUARTERS;
    } else if (beatDensity > 2) {
      this.bbtRulerScale = BBTRulerScale.SHOW_EIGHTHS;
    } else if (beatDensity > 1) {
      this.bbtRulerScale = BBTRulerScale.SHOW_SIXTEENTHS;
    } else if (beatDensity > 0.5) {
      this.bbtRulerScale = BBTRulerScale.SHOW_THIRTYSECONDS;
    } else if (beatDensity > 0.25) {
      this.bbtRulerScale = BBTRulerScale.SHOW_SIXTYFOURTHS;
    } else {
      this.bbtRulerScale = BBTRulerScale.SHOW_ONETWENTYEIGHTHS;
    }
  }

  /**
   * BBT 그리드 포인트 계산 (Ardour의 compute_current_bbt_points)
   * @param lowerSeconds 하한 (초)
   * @param upperSeconds 상한 (초)
   * @returns BBT 그리드 포인트 배열
   */
  private computeCurrentBBTPoints(
    lowerSeconds: number,
    upperSeconds: number
  ): Array<{ time: number; bbt: any; isBar: boolean; isBeat: boolean }> {
    const points: Array<{
      time: number;
      bbt: any;
      isBar: boolean;
      isBeat: boolean;
    }> = [];

    // 스케일에 따라 그리드 간격 결정
    const beatsPerBar = this.tempoMap.getBeatsPerBar();
    let gridInterval: number;

    switch (this.bbtRulerScale) {
      case BBTRulerScale.SHOW_MANY:
      case BBTRulerScale.SHOW_64:
      case BBTRulerScale.SHOW_16:
      case BBTRulerScale.SHOW_4:
      case BBTRulerScale.SHOW_1:
        // Bar 단위만
        gridInterval = beatsPerBar;
        break;
      case BBTRulerScale.SHOW_QUARTERS:
        // Beat 단위 (quarter notes)
        gridInterval = 1;
        break;
      case BBTRulerScale.SHOW_EIGHTHS:
        gridInterval = 0.5;
        break;
      case BBTRulerScale.SHOW_SIXTEENTHS:
        gridInterval = 0.25;
        break;
      case BBTRulerScale.SHOW_THIRTYSECONDS:
        gridInterval = 0.125;
        break;
      case BBTRulerScale.SHOW_SIXTYFOURTHS:
        gridInterval = 0.0625;
        break;
      case BBTRulerScale.SHOW_ONETWENTYEIGHTHS:
        gridInterval = 0.03125;
        break;
      default:
        gridInterval = beatsPerBar;
    }

    // 시작과 끝을 Beats로 변환
    const startBeats = this.tempoMap.secondsToBeats(lowerSeconds);
    const endBeats = this.tempoMap.secondsToBeats(upperSeconds);

    // 시작을 gridInterval의 배수로 반올림
    const startGrid = Math.floor(startBeats / gridInterval) * gridInterval;
    const endGrid = Math.ceil(endBeats / gridInterval) * gridInterval;

    // 그리드 포인트 생성
    for (let beats = startGrid; beats <= endGrid; beats += gridInterval) {
      const time = this.tempoMap.beatsToSeconds(beats);
      if (time >= lowerSeconds && time <= upperSeconds) {
        const bbt = this.tempoMap.secondsToBBT(time);
        const isBar = bbt.beats === 1 && bbt.ticks === 0;
        const isBeat = bbt.ticks === 0;

        points.push({ time, bbt, isBar, isBeat });
      }
    }

    return points;
  }

  getMarks(
    lower: number,
    upper: number,
    _maxChars: number,
    contentWidth?: number
  ): RulerMark[] {
    const marks: RulerMark[] = [];

    // BBT Ruler 스케일 계산
    this.computeBBTRulerScale(lower, upper, contentWidth);

    // BBT 그리드 포인트 계산
    const grid = this.computeCurrentBBTPoints(lower, upper);

    if (grid.length === 0) {
      return marks;
    }

    // 스케일에 따라 마크 생성
    switch (this.bbtRulerScale) {
      case BBTRulerScale.SHOW_MANY:
        // 너무 많은 bar - 최소한의 bar 표시 (64 bar 간격)
        // 에러 메시지 대신 실제 bar 표시
        for (const point of grid) {
          if (point.isBar) {
            const barNum = point.bbt.bars;
            // 64 bar 간격으로 표시
            if (barNum % 64 === 1) {
              marks.push({
                position: point.time,
                label: String(barNum),
                style: 'major',
              });
            }
          }
        }
        // bar가 없으면 최소한 첫 번째 bar 표시
        if (marks.length === 0 && grid.length > 0) {
          const firstBar = grid.find(p => p.isBar);
          if (firstBar) {
            marks.push({
              position: firstBar.time,
              label: String(firstBar.bbt.bars),
              style: 'major',
            });
          }
        }
        break;

      case BBTRulerScale.SHOW_64:
        // 64 bar 간격
        for (const point of grid) {
          if (point.isBar) {
            const barNum = point.bbt.bars;
            if (barNum % 64 === 1) {
              if (barNum % 256 === 1) {
                marks.push({
                  position: point.time,
                  label: String(barNum),
                  style: 'major',
                });
              } else {
                marks.push({
                  position: point.time,
                  label: '',
                  style: barNum % 256 === 129 ? 'minor' : 'micro',
                });
              }
            }
          }
        }
        break;

      case BBTRulerScale.SHOW_16:
        // 16 bar 간격
        for (const point of grid) {
          if (point.isBar) {
            const barNum = point.bbt.bars;
            if (barNum % 16 === 1) {
              if (barNum % 64 === 1) {
                marks.push({
                  position: point.time,
                  label: String(barNum),
                  style: 'major',
                });
              } else {
                marks.push({
                  position: point.time,
                  label: '',
                  style: barNum % 64 === 33 ? 'minor' : 'micro',
                });
              }
            }
          }
        }
        break;

      case BBTRulerScale.SHOW_4:
        // 4 bar 간격
        for (const point of grid) {
          if (point.isBar) {
            const barNum = point.bbt.bars;
            if (barNum % 4 === 1) {
              marks.push({
                position: point.time,
                label: barNum % 16 === 1 ? String(barNum) : '',
                style: barNum % 16 === 1 ? 'major' : 'minor',
              });
            }
          }
        }
        break;

      case BBTRulerScale.SHOW_1:
        // 모든 bar
        for (const point of grid) {
          if (point.isBar) {
            marks.push({
              position: point.time,
              label: String(point.bbt.bars),
              style: 'major',
            });
          }
        }
        break;

      case BBTRulerScale.SHOW_QUARTERS:
        // Bar와 Beat 표시
        for (const point of grid) {
          if (point.isBar) {
            marks.push({
              position: point.time,
              label: String(point.bbt.bars),
              style: 'major',
            });
          } else if (point.isBeat && point.bbt.beats % 2 === 1) {
            marks.push({
              position: point.time,
              label: '',
              style: 'minor',
            });
          } else if (point.isBeat) {
            marks.push({
              position: point.time,
              label: '',
              style: 'micro',
            });
          }
        }
        break;

      case BBTRulerScale.SHOW_EIGHTHS:
      case BBTRulerScale.SHOW_SIXTEENTHS:
      case BBTRulerScale.SHOW_THIRTYSECONDS:
      case BBTRulerScale.SHOW_SIXTYFOURTHS:
      case BBTRulerScale.SHOW_ONETWENTYEIGHTHS:
        // Bar, Beat, Tick 표시
        for (const point of grid) {
          if (point.isBar) {
            marks.push({
              position: point.time,
              label: String(point.bbt.bars),
              style: 'major',
            });
          } else if (point.isBeat) {
            marks.push({
              position: point.time,
              label: String(point.bbt.beats),
              style: 'minor',
            });
          } else {
            marks.push({
              position: point.time,
              label: '',
              style: 'micro',
            });
          }
        }
        break;
    }

    return marks.sort((a, b) => a.position - b.position);
  }
}

/**
 * BBT Ruler Scale enum (Ardour의 BBTRulerScale)
 */
enum BBTRulerScale {
  SHOW_MANY = 0,
  SHOW_64 = 1,
  SHOW_16 = 2,
  SHOW_4 = 3,
  SHOW_1 = 4,
  SHOW_QUARTERS = 5,
  SHOW_EIGHTHS = 6,
  SHOW_SIXTEENTHS = 7,
  SHOW_THIRTYSECONDS = 8,
  SHOW_SIXTYFOURTHS = 9,
  SHOW_ONETWENTYEIGHTHS = 10,
}

/**
 * Timecode Metric - 타임코드 표시 (HH:MM:SS:FF)
 */
export class TimecodeMetric implements Metric {
  unitsPerPixel: number = 0;

  constructor(_sampleRate: number = 44100) {
    // sampleRate는 향후 프레임 레이트 계산에 사용될 수 있음
  }

  // TODO: maxChars 파라미터는 향후 레이블 길이 제한에 사용 (현재 미구현)
  // Ardour처럼 레이블이 겹칠 때 짧게 표시하거나 생략하는 기능
  getMarks(
    lower: number,
    upper: number,
    _maxChars: number,
    contentWidth?: number
  ): RulerMark[] {
    const marks: RulerMark[] = [];
    const range = upper - lower;

    // 자동 스케일링: 범위에 따라 간격 조정
    let interval: number;
    let format: (seconds: number) => string;
    let maxMarks: number | undefined;

    if (range <= 0.1) {
      // 0.1초 이하: 밀리초 단위
      interval = 0.01;
      format = (s: number) => {
        const ms = Math.floor((s % 1) * 1000);
        const secs = Math.floor(s);
        return `${secs}.${String(ms).padStart(3, '0')}`;
      };
    } else if (range <= 1) {
      // 1초 이하: 프레임 단위 (30fps 가정)
      interval = 1 / 30;
      format = (s: number) => {
        const frames = Math.floor((s % 1) * 30);
        const secs = Math.floor(s % 60);
        return `${secs}:${String(frames).padStart(2, '0')}`;
      };
    } else if (range <= 5) {
      // 5초 이하: 0.5초 간격
      interval = 0.5;
      format = (s: number) => {
        const secs = Math.floor(s % 60);
        const mins = Math.floor(s / 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      };
    } else if (range <= 10) {
      // 10초 이하: 초 단위
      interval = 1;
      format = (s: number) => {
        const secs = Math.floor(s % 60);
        const mins = Math.floor(s / 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      };
    } else if (range <= 30) {
      // 30초 이하: 5초 간격
      interval = 5;
      format = (s: number) => {
        const secs = Math.floor(s % 60);
        const mins = Math.floor(s / 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      };
    } else if (range <= 60) {
      // 1분 이하: 10초 간격
      interval = 10;
      format = (s: number) => {
        const secs = Math.floor(s % 60);
        const mins = Math.floor(s / 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      };
    } else if (range <= 300) {
      // 5분 이하: 30초 간격
      interval = 30;
      format = (s: number) => {
        const mins = Math.floor(s / 60);
        const hours = Math.floor(mins / 60);
        return `${String(hours).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      };
    } else if (range <= 8 * 60 * 60) {
      // 8시간 이하: 분 단위
      interval = 60;
      format = (s: number) => {
        const mins = Math.floor(s / 60);
        const hours = Math.floor(mins / 60);
        return `${String(hours).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      };
    } else if (range <= 16 * 60 * 60) {
      // 16시간 이하: 시간 단위
      interval = 60 * 60;
      format = (s: number) => {
        const mins = Math.floor(s / 60);
        const hours = Math.floor(mins / 60);
        return `${String(hours).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      };
    } else {
      // 16시간 이상: contentWidth를 사용하여 마크 개수 계산 (Ardour 패턴)
      // Ardour: timecode_nmarks = _track_canvas->width() / text_width_rough_guess (120px)
      const textWidthRoughGuess = 120; // 픽셀, 레이블 텍스트 예상 너비

      if (contentWidth) {
        maxMarks = Math.max(2, Math.floor(contentWidth / textWidthRoughGuess));
      } else {
        maxMarks = 24; // 기본값: 24시간
      }

      const hoursInRange = range / (60 * 60);
      const markModulo = Math.max(1, Math.floor(hoursInRange / maxMarks));
      interval = markModulo * 60 * 60; // 시간 단위 간격

      format = (s: number) => {
        const mins = Math.floor(s / 60);
        const hours = Math.floor(mins / 60);
        return `${String(hours).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      };
    }

    // 마크 생성
    const start = Math.floor(lower / interval) * interval;
    const end = Math.ceil(upper / interval) * interval;

    let markCount = 0;
    for (let time = start; time <= end; time += interval) {
      if (time >= lower && time <= upper) {
        // maxMarks가 설정된 경우 개수 제한
        if (maxMarks !== undefined && markCount >= maxMarks) {
          break;
        }

        const isMajor = time % (interval * 5) === 0 || time === start;
        marks.push({
          position: time,
          label: format(time),
          style: isMajor ? 'major' : 'minor',
        });
        markCount++;
      }
    }

    return marks;
  }
}

/**
 * Samples Metric - 샘플 번호 표시
 */
export class SamplesMetric implements Metric {
  unitsPerPixel: number = 0;
  private sampleRate: number;

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
  }

  // TODO: maxChars 파라미터는 향후 레이블 길이 제한에 사용 (현재 미구현)
  // Ardour처럼 레이블이 겹칠 때 짧게 표시하거나 생략하는 기능
  getMarks(
    lower: number,
    upper: number,
    _maxChars: number,
    _contentWidth?: number
  ): RulerMark[] {
    const marks: RulerMark[] = [];

    // 샘플 단위로 변환
    const lowerSamples = Math.floor(lower * this.sampleRate);
    const upperSamples = Math.ceil(upper * this.sampleRate);
    const rangeSamples = upperSamples - lowerSamples;

    // 자동 스케일링: 범위에 따라 간격 조정
    let interval: number;
    if (rangeSamples <= 100) {
      interval = 10;
    } else if (rangeSamples <= 1000) {
      interval = 100;
    } else if (rangeSamples <= 10000) {
      interval = 1000;
    } else if (rangeSamples <= 100000) {
      interval = 10000;
    } else if (rangeSamples <= 1000000) {
      interval = 100000;
    } else {
      interval = 1000000;
    }

    // 마크 생성
    const start = Math.floor(lowerSamples / interval) * interval;
    const end = Math.ceil(upperSamples / interval) * interval;

    for (let samples = start; samples <= end; samples += interval) {
      const time = samples / this.sampleRate;
      if (time >= lower && time <= upper) {
        marks.push({
          position: time,
          label: String(samples),
          style: 'major',
        });
      }
    }

    return marks;
  }
}

/**
 * MinSec Metric - 분:초 표시
 */
export class MinSecMetric implements Metric {
  unitsPerPixel: number = 0;

  // TODO: maxChars 파라미터는 향후 레이블 길이 제한에 사용 (현재 미구현)
  // Ardour처럼 레이블이 겹칠 때 짧게 표시하거나 생략하는 기능
  getMarks(
    lower: number,
    upper: number,
    _maxChars: number,
    contentWidth?: number
  ): RulerMark[] {
    const marks: RulerMark[] = [];
    const range = upper - lower;

    // 자동 스케일링: 범위에 따라 간격 조정
    let interval: number;
    let format: (seconds: number) => string;
    let maxMarks: number | undefined;

    if (range <= 0.1) {
      // 0.1초 이하: 밀리초
      interval = 0.01;
      format = (s: number) => {
        const ms = Math.floor((s % 1) * 1000);
        const secs = Math.floor(s);
        return `${secs}.${String(ms).padStart(3, '0')}`;
      };
    } else if (range <= 1) {
      // 1초 이하: 0.1초 간격
      interval = 0.1;
      format = (s: number) => {
        const ms = Math.floor((s % 1) * 1000);
        const secs = Math.floor(s);
        return `${secs}.${String(ms).padStart(3, '0')}`;
      };
    } else if (range <= 5) {
      // 5초 이하: 0.5초 간격
      interval = 0.5;
      format = (s: number) => {
        const secs = Math.floor(s % 60);
        const mins = Math.floor(s / 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      };
    } else if (range <= 10) {
      // 10초 이하: 초 단위
      interval = 1;
      format = (s: number) => {
        const secs = Math.floor(s % 60);
        const mins = Math.floor(s / 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      };
    } else if (range <= 30) {
      // 30초 이하: 5초 간격
      interval = 5;
      format = (s: number) => {
        const secs = Math.floor(s % 60);
        const mins = Math.floor(s / 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      };
    } else if (range <= 60) {
      // 1분 이하: 10초 간격
      interval = 10;
      format = (s: number) => {
        const secs = Math.floor(s % 60);
        const mins = Math.floor(s / 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      };
    } else if (range <= 300) {
      // 5분 이하: 30초 간격
      interval = 30;
      format = (s: number) => {
        const mins = Math.floor(s / 60);
        const hours = Math.floor(mins / 60);
        return `${String(hours).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      };
    } else if (range <= 8 * 60 * 60) {
      // 8시간 이하: 분 단위
      interval = 60;
      format = (s: number) => {
        const mins = Math.floor(s / 60);
        const hours = Math.floor(mins / 60);
        return `${String(hours).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      };
    } else if (range <= 16 * 60 * 60) {
      // 16시간 이하: 시간 단위
      interval = 60 * 60;
      format = (s: number) => {
        const mins = Math.floor(s / 60);
        const hours = Math.floor(mins / 60);
        return `${String(hours).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      };
    } else {
      // 16시간 이상: contentWidth를 사용하여 마크 개수 계산 (Ardour 패턴)
      // Ardour: minsec_nmarks = _track_canvas->width() / text_width_rough_guess (70px)
      const textWidthRoughGuess = 70; // 픽셀, 레이블 텍스트 예상 너비

      if (contentWidth) {
        maxMarks = Math.max(2, Math.floor(contentWidth / textWidthRoughGuess));
      } else {
        maxMarks = 24; // 기본값: 24시간
      }

      const hoursInRange = range / (60 * 60);
      const markModulo = Math.max(1, Math.floor(hoursInRange / maxMarks));
      interval = markModulo * 60 * 60; // 시간 단위 간격

      format = (s: number) => {
        const mins = Math.floor(s / 60);
        const hours = Math.floor(mins / 60);
        return `${String(hours).padStart(2, '0')}:00`; // 긴 범위에서는 분 생략
      };
    }

    // 마크 생성
    const start = Math.floor(lower / interval) * interval;
    const end = Math.ceil(upper / interval) * interval;

    let markCount = 0;
    for (let time = start; time <= end; time += interval) {
      if (time >= lower && time <= upper) {
        // maxMarks가 설정된 경우 개수 제한
        if (maxMarks !== undefined && markCount >= maxMarks) {
          break;
        }

        const isMajor = time % (interval * 5) === 0 || time === start;
        marks.push({
          position: time,
          label: format(time),
          style: isMajor ? 'major' : 'minor',
        });
        markCount++;
      }
    }

    return marks;
  }
}
