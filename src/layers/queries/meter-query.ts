import type { MeterFrame, MeterTarget } from '../shared/types/meter-frame';

export interface IMeterFrameSource {
  readMeterFrame(target: MeterTarget): MeterFrame;
}

export interface IMeterQuery {
  read(target: MeterTarget): MeterFrame;
}

export class MeterQuery implements IMeterQuery {
  constructor(private readonly meterFrameSource: IMeterFrameSource) {}

  read(target: MeterTarget): MeterFrame {
    const frame = this.meterFrameSource.readMeterFrame(target);
    return {
      capturedAtSeconds: frame.capturedAtSeconds,
      channels: frame.channels.map(channel => ({ ...channel })),
    };
  }
}
