import type { MeterFrame } from '../../shared/types/meter-frame';
import { MeterFrameAccumulator } from './meter-frame-accumulator';

export interface IWaveformAnalyser {
  dispose(): void;
  getValue(): Float32Array | Float32Array[];
}

export interface IAudioMeterRuntime {
  dispose(): void;
  read(): MeterFrame;
}

interface AudioMeterRuntimeOptions {
  readonly analyser: IWaveformAnalyser;
  readonly getCurrentTimeSeconds: () => number;
}

export class AudioMeterRuntime implements IAudioMeterRuntime {
  readonly #accumulator = new MeterFrameAccumulator();
  readonly #analyser: IWaveformAnalyser;
  readonly #getCurrentTimeSeconds: () => number;

  constructor({ analyser, getCurrentTimeSeconds }: AudioMeterRuntimeOptions) {
    this.#analyser = analyser;
    this.#getCurrentTimeSeconds = getCurrentTimeSeconds;
  }

  dispose(): void {
    this.#analyser.dispose();
  }

  read(): MeterFrame {
    const values = this.#analyser.getValue();
    return this.#accumulator.read({
      capturedAtSeconds: this.#getCurrentTimeSeconds(),
      channelSamples: Array.isArray(values) ? values : [values],
    });
  }
}
