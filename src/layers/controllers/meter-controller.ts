import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { MeterFrame, MeterTarget } from '../shared/types/meter-frame';

export class MeterController {
  constructor(private readonly audioEngine: IAudioEngine) {}

  readMeterFrame(target: MeterTarget): MeterFrame {
    return this.audioEngine.readMeterFrame(target);
  }
}
