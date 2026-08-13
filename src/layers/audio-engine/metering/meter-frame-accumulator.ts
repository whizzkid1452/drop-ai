import type { MeterFrame } from '../../shared/types/meter-frame';

interface MeterFrameAccumulatorOptions {
  readonly clipHoldSeconds?: number;
}

interface ReadMeterSamplesRequest {
  readonly capturedAtSeconds: number;
  readonly channelSamples: readonly Float32Array[];
}

const DEFAULT_CLIP_HOLD_SECONDS = 2;

export class MeterFrameAccumulator {
  readonly #clipHoldSeconds: number;
  readonly #clipHeldUntilSecondsByChannel: number[] = [];

  constructor({ clipHoldSeconds = DEFAULT_CLIP_HOLD_SECONDS }: MeterFrameAccumulatorOptions = {}) {
    if (!Number.isFinite(clipHoldSeconds) || clipHoldSeconds < 0) {
      throw new RangeError('clipHoldSeconds는 0 이상의 유한 숫자여야 합니다.');
    }
    this.#clipHoldSeconds = clipHoldSeconds;
  }

  read({ capturedAtSeconds, channelSamples }: ReadMeterSamplesRequest): MeterFrame {
    if (!Number.isFinite(capturedAtSeconds) || capturedAtSeconds < 0) {
      throw new RangeError('capturedAtSeconds는 0 이상의 유한 숫자여야 합니다.');
    }

    return {
      capturedAtSeconds,
      channels: channelSamples.map((samples, channelIndex) => {
        const { peak, rms } = calculateLinearLevels(samples);
        const isClipping = peak >= 1;
        if (isClipping) {
          this.#clipHeldUntilSecondsByChannel[channelIndex] = capturedAtSeconds + this.#clipHoldSeconds;
        }

        return {
          isClipHeld: isClipping || capturedAtSeconds < (this.#clipHeldUntilSecondsByChannel[channelIndex] ?? 0),
          peakDbfs: linearGainToDbfs(peak),
          rmsDbfs: linearGainToDbfs(rms),
        };
      }),
    };
  }
}

function calculateLinearLevels(samples: Float32Array): { readonly peak: number; readonly rms: number } {
  if (samples.length === 0) {
    return { peak: 0, rms: 0 };
  }

  let peak = 0;
  let sumOfSquares = 0;
  for (const sample of samples) {
    const finiteSample = Number.isFinite(sample) ? sample : 0;
    const amplitude = Math.abs(finiteSample);
    peak = Math.max(peak, amplitude);
    sumOfSquares += finiteSample * finiteSample;
  }

  return { peak, rms: Math.sqrt(sumOfSquares / samples.length) };
}

function linearGainToDbfs(linearGain: number): number {
  return linearGain === 0 ? -Infinity : 20 * Math.log10(linearGain);
}
