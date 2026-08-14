import type { ExportNormalizationState } from '../../shared/types/export-state';
import type { RenderAnalysis } from '../../shared/types/render-job';

const SILENCE_DB = Number.NEGATIVE_INFINITY;
const ABSOLUTE_GATE_LUFS = -70;
const INTEGRATED_BLOCK_SECONDS = 0.4;
const INTEGRATED_BLOCK_OVERLAP = 0.75;
const SHORT_TERM_BLOCK_SECONDS = 3;
const SHORT_TERM_STEP_SECONDS = 1;
const LOUDNESS_OFFSET_DB = -0.691;
const TRUE_PEAK_OVERSAMPLE_FACTOR = 4;

interface AnalyzeRenderedPcmRequest {
  readonly channels: readonly Float32Array[];
  readonly sampleRate: number;
}

interface CalculateNormalizationGainRequest {
  readonly analysis: RenderAnalysis;
  readonly normalization: ExportNormalizationState;
}

interface BiquadCoefficients {
  readonly a1: number;
  readonly a2: number;
  readonly b0: number;
  readonly b1: number;
  readonly b2: number;
}

function amplitudeToDb(amplitude: number): number {
  return amplitude > 0 ? 20 * Math.log10(amplitude) : SILENCE_DB;
}

function energyToLufs(energy: number): number {
  return energy > 0 ? LOUDNESS_OFFSET_DB + 10 * Math.log10(energy) : SILENCE_DB;
}

function createHighShelfCoefficients(sampleRate: number): BiquadCoefficients {
  const gainDb = 4;
  const frequency = 1_500;
  const amplitude = 10 ** (gainDb / 40);
  const angularFrequency = (2 * Math.PI * frequency) / sampleRate;
  const cosine = Math.cos(angularFrequency);
  const sine = Math.sin(angularFrequency);
  const alpha = sine / 2;
  const squareRootAmplitude = Math.sqrt(amplitude);
  const a0 = amplitude + 1 - (amplitude - 1) * cosine + 2 * squareRootAmplitude * alpha;
  return {
    a1: (2 * (amplitude - 1 - (amplitude + 1) * cosine)) / a0,
    a2: (amplitude + 1 - (amplitude - 1) * cosine - 2 * squareRootAmplitude * alpha) / a0,
    b0: (amplitude * (amplitude + 1 + (amplitude - 1) * cosine + 2 * squareRootAmplitude * alpha)) / a0,
    b1: (-2 * amplitude * (amplitude - 1 + (amplitude + 1) * cosine)) / a0,
    b2: (amplitude * (amplitude + 1 + (amplitude - 1) * cosine - 2 * squareRootAmplitude * alpha)) / a0,
  };
}

function createHighPassCoefficients(sampleRate: number): BiquadCoefficients {
  const frequency = 38;
  const qualityFactor = 0.5;
  const angularFrequency = (2 * Math.PI * frequency) / sampleRate;
  const cosine = Math.cos(angularFrequency);
  const alpha = Math.sin(angularFrequency) / (2 * qualityFactor);
  const a0 = 1 + alpha;
  return {
    a1: (-2 * cosine) / a0,
    a2: (1 - alpha) / a0,
    b0: (1 + cosine) / 2 / a0,
    b1: -(1 + cosine) / a0,
    b2: (1 + cosine) / 2 / a0,
  };
}

function applyBiquad(input: Float32Array, coefficients: BiquadCoefficients): Float64Array {
  const output = new Float64Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let index = 0; index < input.length; index += 1) {
    const x0 = input[index] ?? 0;
    const y0 =
      coefficients.b0 * x0 + coefficients.b1 * x1 + coefficients.b2 * x2 - coefficients.a1 * y1 - coefficients.a2 * y2;
    output[index] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return output;
}

function applyBiquadToFloat64(input: Float64Array, coefficients: BiquadCoefficients): Float64Array {
  return applyBiquad(Float32Array.from(input), coefficients);
}

function applyKWeighting(channels: readonly Float32Array[], sampleRate: number): readonly Float64Array[] {
  const shelf = createHighShelfCoefficients(sampleRate);
  const highPass = createHighPassCoefficients(sampleRate);
  return channels.map(channel => applyBiquadToFloat64(applyBiquad(channel, shelf), highPass));
}

function calculateBlockEnergies(
  channels: readonly Float64Array[],
  sampleRate: number,
  blockSeconds: number,
  stepSeconds: number
): number[] {
  const frameCount = channels[0]?.length ?? 0;
  if (frameCount === 0) {
    return [];
  }
  const blockFrames = Math.max(1, Math.round(blockSeconds * sampleRate));
  const stepFrames = Math.max(1, Math.round(stepSeconds * sampleRate));
  const starts =
    frameCount <= blockFrames
      ? [0]
      : Array.from(
          { length: Math.floor((frameCount - blockFrames) / stepFrames) + 1 },
          (_, index) => index * stepFrames
        );
  return starts.map(start => {
    const end = Math.min(frameCount, start + blockFrames);
    const frameLength = Math.max(1, end - start);
    return channels.reduce((channelSum, channel) => {
      let sumSquares = 0;
      for (let index = start; index < end; index += 1) {
        const sample = channel[index] ?? 0;
        sumSquares += sample * sample;
      }
      return channelSum + sumSquares / frameLength;
    }, 0);
  });
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateIntegratedLufs(blockEnergies: readonly number[]): number {
  const aboveAbsoluteGate = blockEnergies.filter(energy => energyToLufs(energy) >= ABSOLUTE_GATE_LUFS);
  if (aboveAbsoluteGate.length === 0) {
    return SILENCE_DB;
  }
  const relativeGate = energyToLufs(average(aboveAbsoluteGate)) - 10;
  const gatedEnergies = aboveAbsoluteGate.filter(energy => energyToLufs(energy) >= relativeGate);
  return energyToLufs(average(gatedEnergies));
}

function percentile(sortedValues: readonly number[], proportion: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.round((sortedValues.length - 1) * proportion)));
  return sortedValues[index] ?? 0;
}

function calculateLoudnessRange(shortTermEnergies: readonly number[], integratedLufs: number): number {
  if (!Number.isFinite(integratedLufs)) {
    return 0;
  }
  const relativeGate = integratedLufs - 20;
  const loudnessValues = shortTermEnergies
    .map(energyToLufs)
    .filter(value => value >= ABSOLUTE_GATE_LUFS && value >= relativeGate)
    .sort((left, right) => left - right);
  return Math.max(0, percentile(loudnessValues, 0.95) - percentile(loudnessValues, 0.1));
}

function interpolateCubic(channel: Float32Array, index: number, phase: number): number {
  const previous = channel[Math.max(0, index - 1)] ?? 0;
  const current = channel[index] ?? 0;
  const next = channel[Math.min(channel.length - 1, index + 1)] ?? current;
  const following = channel[Math.min(channel.length - 1, index + 2)] ?? next;
  const coefficientA = -0.5 * previous + 1.5 * current - 1.5 * next + 0.5 * following;
  const coefficientB = previous - 2.5 * current + 2 * next - 0.5 * following;
  const coefficientC = -0.5 * previous + 0.5 * next;
  return ((coefficientA * phase + coefficientB) * phase + coefficientC) * phase + current;
}

function findTruePeakEstimate(channels: readonly Float32Array[]): number {
  let peak = 0;
  channels.forEach(channel => {
    for (let sampleIndex = 0; sampleIndex < channel.length; sampleIndex += 1) {
      for (let phase = 0; phase < TRUE_PEAK_OVERSAMPLE_FACTOR; phase += 1) {
        peak = Math.max(peak, Math.abs(interpolateCubic(channel, sampleIndex, phase / TRUE_PEAK_OVERSAMPLE_FACTOR)));
      }
    }
  });
  return peak;
}

export function analyzeRenderedPcm({ channels, sampleRate }: AnalyzeRenderedPcmRequest): RenderAnalysis {
  const samplePeak = channels.reduce((peak, channel) => {
    let channelPeak = 0;
    channel.forEach(sample => {
      channelPeak = Math.max(channelPeak, Math.abs(sample));
    });
    return Math.max(peak, channelPeak);
  }, 0);
  const weightedChannels = applyKWeighting(channels, sampleRate);
  const integratedEnergies = calculateBlockEnergies(
    weightedChannels,
    sampleRate,
    INTEGRATED_BLOCK_SECONDS,
    INTEGRATED_BLOCK_SECONDS * (1 - INTEGRATED_BLOCK_OVERLAP)
  );
  const integratedLufs = calculateIntegratedLufs(integratedEnergies);
  const shortTermEnergies = calculateBlockEnergies(
    weightedChannels,
    sampleRate,
    SHORT_TERM_BLOCK_SECONDS,
    SHORT_TERM_STEP_SECONDS
  );
  return {
    integratedLufs,
    loudnessRangeLu: calculateLoudnessRange(shortTermEnergies, integratedLufs),
    normalizationGainDb: 0,
    samplePeakDbfs: amplitudeToDb(samplePeak),
    truePeakDbtp: amplitudeToDb(findTruePeakEstimate(channels)),
  };
}

export function calculateNormalizationGainDb({ analysis, normalization }: CalculateNormalizationGainRequest): number {
  if (normalization.mode === 'none') {
    return 0;
  }
  if (normalization.mode === 'peak') {
    return Number.isFinite(analysis.truePeakDbtp) ? normalization.targetDbfs - analysis.truePeakDbtp : 0;
  }
  return Number.isFinite(analysis.integratedLufs) ? normalization.targetLufs - analysis.integratedLufs : 0;
}
