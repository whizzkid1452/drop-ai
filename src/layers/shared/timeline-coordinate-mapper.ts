export const TICKS_PER_BEAT = 1_920;

const DEFAULT_PIXELS_PER_QUARTER_NOTE = 48;
const SUPPORTED_BEAT_UNITS = new Set([1, 2, 4, 8, 16, 32]);

export interface BBTPosition {
  readonly bar: number;
  readonly beat: number;
  readonly tick: number;
}

export interface TimelineCoordinateMapperOptions {
  readonly tempoBpm: number;
  readonly beatsPerBar: number;
  readonly beatUnit: number;
  readonly pixelsPerQuarterNote?: number;
}

interface TimelineDuration {
  readonly startSeconds: number;
  readonly durationSeconds: number;
}

export class TimelineCoordinateMapper {
  readonly #beatUnit: number;
  readonly #beatsPerBar: number;
  readonly #pixelsPerQuarterNote: number;
  readonly #tempoBpm: number;

  constructor({
    tempoBpm,
    beatsPerBar,
    beatUnit,
    pixelsPerQuarterNote = DEFAULT_PIXELS_PER_QUARTER_NOTE,
  }: TimelineCoordinateMapperOptions) {
    assertPositiveFinite('Tempo', tempoBpm);
    assertPositiveInteger('마디당 박자 수', beatsPerBar);
    assertSupportedBeatUnit(beatUnit);
    assertPositiveFinite('quarter note당 pixel', pixelsPerQuarterNote);

    this.#tempoBpm = tempoBpm;
    this.#beatsPerBar = beatsPerBar;
    this.#beatUnit = beatUnit;
    this.#pixelsPerQuarterNote = pixelsPerQuarterNote;
  }

  get pixelsPerQuarterNote(): number {
    return this.#pixelsPerQuarterNote;
  }

  secondsToQuarterNotes(seconds: number): number {
    assertNonNegativeFinite('초 위치', seconds);
    return seconds * (this.#tempoBpm / 60);
  }

  quarterNotesToSeconds(quarterNotes: number): number {
    assertNonNegativeFinite('quarter note 위치', quarterNotes);
    return quarterNotes * (60 / this.#tempoBpm);
  }

  secondsToBBT(seconds: number): BBTPosition {
    // 박자표 분모가 8이면 한 박자는 8분음표이므로 0.5 quarter note로 환산합니다.
    const meterBeatQuarterNotes = 4 / this.#beatUnit;
    const absoluteMeterBeats = this.secondsToQuarterNotes(seconds) / meterBeatQuarterNotes;
    const absoluteWholeBeats = Math.floor(absoluteMeterBeats);
    const fractionalBeat = absoluteMeterBeats - absoluteWholeBeats;
    const roundedTick = Math.round(fractionalBeat * TICKS_PER_BEAT);
    // 반올림 결과가 한 박자와 같아지면 다음 박자로 올려 BBT 범위를 유지합니다.
    const normalizedWholeBeats = absoluteWholeBeats + Math.floor(roundedTick / TICKS_PER_BEAT);
    const tick = roundedTick % TICKS_PER_BEAT;

    return {
      bar: Math.floor(normalizedWholeBeats / this.#beatsPerBar) + 1,
      beat: (normalizedWholeBeats % this.#beatsPerBar) + 1,
      tick,
    };
  }

  bbtToSeconds(position: BBTPosition): number {
    this.#assertBBTPosition(position);
    const absoluteMeterBeats =
      (position.bar - 1) * this.#beatsPerBar + (position.beat - 1) + position.tick / TICKS_PER_BEAT;
    const meterBeatQuarterNotes = 4 / this.#beatUnit;

    return this.quarterNotesToSeconds(absoluteMeterBeats * meterBeatQuarterNotes);
  }

  secondsToPixels(seconds: number): number {
    return this.secondsToQuarterNotes(seconds) * this.#pixelsPerQuarterNote;
  }

  pixelsToSeconds(pixels: number): number {
    assertNonNegativeFinite('pixel 위치', pixels);
    return this.quarterNotesToSeconds(pixels / this.#pixelsPerQuarterNote);
  }

  durationToPixels({ startSeconds, durationSeconds }: TimelineDuration): number {
    assertNonNegativeFinite('시작 초', startSeconds);
    assertNonNegativeFinite('길이 초', durationSeconds);

    return this.secondsToPixels(startSeconds + durationSeconds) - this.secondsToPixels(startSeconds);
  }

  #assertBBTPosition({ bar, beat, tick }: BBTPosition): void {
    assertPositiveInteger('마디', bar);
    assertPositiveInteger('박자', beat);
    assertNonNegativeInteger('tick', tick);

    if (beat > this.#beatsPerBar) {
      throw new RangeError(`박자는 ${this.#beatsPerBar} 이하여야 합니다.`);
    }
    if (tick >= TICKS_PER_BEAT) {
      throw new RangeError(`tick은 ${TICKS_PER_BEAT} 미만이어야 합니다.`);
    }
  }
}

function assertPositiveFinite(label: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label}는 0보다 큰 유한한 숫자여야 합니다.`);
  }
}

function assertPositiveInteger(label: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label}는 0보다 큰 정수여야 합니다.`);
  }
}

function assertNonNegativeFinite(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label}는 0 이상의 유한한 숫자여야 합니다.`);
  }
}

function assertNonNegativeInteger(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label}는 0 이상의 정수여야 합니다.`);
  }
}

function assertSupportedBeatUnit(beatUnit: number): void {
  if (!SUPPORTED_BEAT_UNITS.has(beatUnit)) {
    throw new RangeError('박자표 분모는 1, 2, 4, 8, 16, 32 중 하나여야 합니다.');
  }
}
