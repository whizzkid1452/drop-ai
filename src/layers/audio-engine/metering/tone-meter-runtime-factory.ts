import * as Tone from 'tone';
import { AudioMeterRuntime, type IAudioMeterRuntime } from './audio-meter-runtime';

export interface IAudioMeterRuntimeFactory {
  create(source: Tone.ToneAudioNode): IAudioMeterRuntime;
}

const METER_CHANNEL_COUNT = 2;
const METER_SAMPLE_COUNT = 512;

export class ToneMeterRuntimeFactory implements IAudioMeterRuntimeFactory {
  create(source: Tone.ToneAudioNode): IAudioMeterRuntime {
    const analyser = new Tone.Analyser({
      channels: METER_CHANNEL_COUNT,
      size: METER_SAMPLE_COUNT,
      smoothing: 0,
      type: 'waveform',
    });
    try {
      source.connect(analyser);
      return new AudioMeterRuntime({ analyser, getCurrentTimeSeconds: () => Tone.now() });
    } catch (error) {
      analyser.dispose();
      throw error;
    }
  }
}
