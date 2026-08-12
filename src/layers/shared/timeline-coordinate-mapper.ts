export const TICKS_PER_BEAT = 1_920;

const DEFAULT_PIXELS_PER_QUARTER_NOTE = 48;
const SUPPORTED_BEAT_UNITS = new Set([1, 2, 4, 8, 16, 32]);

export interface BBTPosition {
  readonly bar: number;
  readonly beat: number;
  readonly tick: number;
}

export interface TimelineTempoChange {
  readonly quarterNotePosition: number;
  readonly bpm: number;
}

export interface TimelineMeterChange {
  readonly quarterNotePosition: number;
  readonly beatsPerBar: number;
  readonly beatUnit: number;
}

export interface TimelineCoordinateMapperOptions {
  readonly tempoBpm: number;
  readonly beatsPerBar: number;
  readonly beatUnit: number;
  readonly pixelsPerQuarterNote?: number;
  readonly tempoChanges?: readonly TimelineTempoChange[];
  readonly meterChanges?: readonly TimelineMeterChange[];
}

interface TimelineDuration {
  readonly startSeconds: number;
  readonly durationSeconds: number;
}

interface TempoSegment extends TimelineTempoChange {
  readonly startSeconds: number;
}

interface MeterSegment extends TimelineMeterChange {
  readonly startBar: number;
}

export class TimelineCoordinateMapper {
  readonly #beatUnit: number;
  readonly #beatsPerBar: number;
  readonly #pixelsPerQuarterNote: number;
  readonly #tempoSegments: readonly TempoSegment[];
  readonly #meterSegments: readonly MeterSegment[];

  constructor({
    tempoBpm,
    beatsPerBar,
    beatUnit,
    pixelsPerQuarterNote = DEFAULT_PIXELS_PER_QUARTER_NOTE,
    tempoChanges,
    meterChanges,
  }: TimelineCoordinateMapperOptions) {
    assertPositiveFinite('Tempo', tempoBpm);
    assertPositiveInteger('마디당 박자 수', beatsPerBar);
    assertSupportedBeatUnit(beatUnit);
    assertPositiveFinite('quarter note당 pixel', pixelsPerQuarterNote);

    this.#tempoSegments = createTempoSegments(tempoChanges ?? [{ quarterNotePosition: 0, bpm: tempoBpm }]);
    this.#meterSegments = createMeterSegments(meterChanges ?? [{ quarterNotePosition: 0, beatsPerBar, beatUnit }]);
    this.#beatsPerBar = this.#meterSegments[0].beatsPerBar;
    this.#beatUnit = this.#meterSegments[0].beatUnit;
    this.#pixelsPerQuarterNote = pixelsPerQuarterNote;
  }

  get pixelsPerQuarterNote(): number {
    return this.#pixelsPerQuarterNote;
  }

  get tempoBpm(): number {
    return this.#tempoSegments[0].bpm;
  }

  get beatsPerBar(): number {
    return this.#beatsPerBar;
  }

  get beatUnit(): number {
    return this.#beatUnit;
  }

  get meterBeatQuarterNotes(): number {
    return 4 / this.#beatUnit;
  }

  get pixelsPerSecond(): number {
    return this.secondsToPixels(1);
  }

  secondsToQuarterNotes(seconds: number): number {
    assertNonNegativeFinite('초 위치', seconds);
    // Tempo marker까지 누적한 초와 현재 구간 BPM을 합쳐 가변 Tempo를 적분합니다.
    const segment = findLastSegment(this.#tempoSegments, item => item.startSeconds <= seconds);
    return segment.quarterNotePosition + (seconds - segment.startSeconds) * (segment.bpm / 60);
  }

  quarterNotesToSeconds(quarterNotes: number): number {
    assertNonNegativeFinite('quarter note 위치', quarterNotes);
    const segment = findLastSegment(this.#tempoSegments, item => item.quarterNotePosition <= quarterNotes);
    return segment.startSeconds + (quarterNotes - segment.quarterNotePosition) * (60 / segment.bpm);
  }

  secondsToBBT(seconds: number): BBTPosition {
    const quarterNotes = this.secondsToQuarterNotes(seconds);
    const segment = findLastSegment(this.#meterSegments, item => item.quarterNotePosition <= quarterNotes);
    const meterBeatQuarterNotes = 4 / segment.beatUnit;
    const localMeterBeats = (quarterNotes - segment.quarterNotePosition) / meterBeatQuarterNotes;
    const absoluteWholeBeats = Math.floor(localMeterBeats);
    const fractionalBeat = localMeterBeats - absoluteWholeBeats;
    const roundedTick = Math.round(fractionalBeat * TICKS_PER_BEAT);
    // 반올림 결과가 한 박자와 같아지면 다음 박자로 올려 BBT 범위를 유지합니다.
    const normalizedWholeBeats = absoluteWholeBeats + Math.floor(roundedTick / TICKS_PER_BEAT);
    const tick = roundedTick % TICKS_PER_BEAT;

    return {
      bar: segment.startBar + Math.floor(normalizedWholeBeats / segment.beatsPerBar),
      beat: (normalizedWholeBeats % segment.beatsPerBar) + 1,
      tick,
    };
  }

  bbtToSeconds(position: BBTPosition): number {
    const segment = findLastSegment(this.#meterSegments, item => item.startBar <= position.bar);
    this.#assertBBTPosition(position, segment);
    const localMeterBeats =
      (position.bar - segment.startBar) * segment.beatsPerBar + (position.beat - 1) + position.tick / TICKS_PER_BEAT;
    const quarterNotes = segment.quarterNotePosition + localMeterBeats * (4 / segment.beatUnit);
    return this.quarterNotesToSeconds(quarterNotes);
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

  getTempoChanges(): readonly TimelineTempoChange[] {
    return this.#tempoSegments.map(({ bpm, quarterNotePosition }) => ({ bpm, quarterNotePosition }));
  }

  getMeterChanges(): readonly TimelineMeterChange[] {
    return this.#meterSegments.map(({ beatUnit, beatsPerBar, quarterNotePosition }) => ({
      beatUnit,
      beatsPerBar,
      quarterNotePosition,
    }));
  }

  getMeterAtQuarterNotes(quarterNotes: number): TimelineMeterChange {
    assertNonNegativeFinite('quarter note 위치', quarterNotes);
    const { beatUnit, beatsPerBar, quarterNotePosition } = findLastSegment(
      this.#meterSegments,
      item => item.quarterNotePosition <= quarterNotes
    );
    return { beatUnit, beatsPerBar, quarterNotePosition };
  }

  #assertBBTPosition({ bar, beat, tick }: BBTPosition, meter: MeterSegment): void {
    assertPositiveInteger('마디', bar);
    assertPositiveInteger('박자', beat);
    assertNonNegativeInteger('tick', tick);

    if (beat > meter.beatsPerBar) {
      throw new RangeError(`박자는 ${meter.beatsPerBar} 이하여야 합니다.`);
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

function createTempoSegments(changes: readonly TimelineTempoChange[]): TempoSegment[] {
  const sortedChanges = [...changes].sort((left, right) => left.quarterNotePosition - right.quarterNotePosition);
  assertFirstMarkerAtZero('Tempo', sortedChanges);

  let startSeconds = 0;
  return sortedChanges.map((change, index) => {
    assertNonNegativeFinite('Tempo quarter note 위치', change.quarterNotePosition);
    assertPositiveFinite('Tempo', change.bpm);
    assertUniqueMarkerPosition(sortedChanges, index, 'Tempo');
    if (index > 0) {
      const previous = sortedChanges[index - 1];
      startSeconds += (change.quarterNotePosition - previous.quarterNotePosition) * (60 / previous.bpm);
    }
    return { ...change, startSeconds };
  });
}

function createMeterSegments(changes: readonly TimelineMeterChange[]): MeterSegment[] {
  const sortedChanges = [...changes].sort((left, right) => left.quarterNotePosition - right.quarterNotePosition);
  assertFirstMarkerAtZero('Meter', sortedChanges);

  let startBar = 1;
  return sortedChanges.map((change, index) => {
    assertNonNegativeFinite('Meter quarter note 위치', change.quarterNotePosition);
    assertPositiveInteger('마디당 박자 수', change.beatsPerBar);
    assertSupportedBeatUnit(change.beatUnit);
    assertUniqueMarkerPosition(sortedChanges, index, 'Meter');
    if (index > 0) {
      const previous = sortedChanges[index - 1];
      const previousBarQuarterNotes = previous.beatsPerBar * (4 / previous.beatUnit);
      const barDelta = (change.quarterNotePosition - previous.quarterNotePosition) / previousBarQuarterNotes;
      if (!Number.isInteger(barDelta)) {
        throw new RangeError('Meter 변경 위치는 이전 박자표의 마디 경계여야 합니다.');
      }
      startBar += barDelta;
    }
    return { ...change, startBar };
  });
}

function assertFirstMarkerAtZero(label: string, changes: readonly { readonly quarterNotePosition: number }[]): void {
  if (changes.length === 0 || changes[0].quarterNotePosition !== 0) {
    throw new RangeError(`${label} Map의 첫 marker는 quarter note 0에 있어야 합니다.`);
  }
}

function assertUniqueMarkerPosition(
  changes: readonly { readonly quarterNotePosition: number }[],
  index: number,
  label: string
): void {
  if (index > 0 && changes[index - 1].quarterNotePosition === changes[index].quarterNotePosition) {
    throw new RangeError(`${label} marker 위치는 중복될 수 없습니다.`);
  }
}

function findLastSegment<T>(segments: readonly T[], predicate: (segment: T) => boolean): T {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (predicate(segment)) {
      return segment;
    }
  }
  return segments[0];
}
