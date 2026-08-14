import * as Tone from 'tone';
import type { MeterFrame } from '../../shared/types/meter-frame';
import { AudioMeterRuntime, type IAudioMeterRuntime, type IWaveformAnalyser } from '../metering/audio-meter-runtime';
import type {
  CreateLoopAudioBufferRequest,
  CreateLoopPlayerRequest,
  ILoopPlaybackAdapter,
  ILoopPlayer,
  SetLoopMonitoringRequest,
} from './loop-playback-adapter';

class ToneLoopPlayer implements ILoopPlayer {
  readonly #player: Tone.Player;
  #hasStarted = false;

  constructor(request: CreateLoopPlayerRequest) {
    this.#player = new Tone.Player({ loop: true, url: request.audioBuffer });
    this.#player.connect(request.destination);
  }

  dispose(): void {
    this.#player.dispose();
  }

  startAt(contextTimeSeconds: number): void {
    if (this.#hasStarted) {
      this.#player.restart(contextTimeSeconds);
      return;
    }
    this.#hasStarted = true;
    this.#player.start(contextTimeSeconds);
  }

  stopAt(contextTimeSeconds: number): void {
    this.#player.stop(contextTimeSeconds);
  }
}

const INPUT_METER_FFT_SIZE = 512;

class WebAudioWaveformAnalyser implements IWaveformAnalyser {
  readonly #analyser: AnalyserNode;
  readonly #samples: Float32Array;

  constructor(analyser: AnalyserNode) {
    this.#analyser = analyser;
    this.#samples = new Float32Array(analyser.fftSize);
  }

  dispose(): void {
    this.#analyser.disconnect();
  }

  getValue(): Float32Array {
    this.#analyser.getFloatTimeDomainData(this.#samples);
    return this.#samples;
  }
}

function assertChannelLengths(channels: readonly Float32Array[]): number {
  const frameCount = channels[0]?.length;
  if (frameCount === undefined || frameCount === 0) {
    throw new RangeError('루프 PCM에는 한 프레임 이상이 필요합니다.');
  }
  if (channels.some(channel => channel.length !== frameCount)) {
    throw new RangeError('모든 루프 PCM 채널의 프레임 수가 같아야 합니다.');
  }
  return frameCount;
}

export class ToneLoopPlaybackAdapter implements ILoopPlaybackAdapter {
  #inputMeterRuntime: IAudioMeterRuntime | null = null;
  #monitorSource: MediaStreamAudioSourceNode | null = null;

  createAudioBuffer(request: CreateLoopAudioBufferRequest): AudioBuffer {
    const frameCount = assertChannelLengths(request.channels);
    const audioBuffer = this.getAudioContext().createBuffer(request.channels.length, frameCount, request.sampleRate);
    request.channels.forEach((channel, channelIndex) => audioBuffer.copyToChannel(channel, channelIndex));
    return audioBuffer;
  }

  createPlayer(request: CreateLoopPlayerRequest): ILoopPlayer {
    return new ToneLoopPlayer(request);
  }

  getAudioContext(): AudioContext {
    const rawContext = Tone.getContext().rawContext;
    if (!('createMediaStreamSource' in rawContext)) {
      throw new Error('실시간 오디오 입력은 AudioContext에서만 사용할 수 있습니다.');
    }
    return rawContext;
  }

  getContextTimeSeconds(): number {
    return Tone.now();
  }

  getTransportTimeSeconds(): number {
    return Tone.getTransport().seconds;
  }

  async prepare(): Promise<void> {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
  }

  readInputMeterFrame(): MeterFrame {
    return (
      this.#inputMeterRuntime?.read() ?? {
        capturedAtSeconds: this.getContextTimeSeconds(),
        channels: [{ isClipHeld: false, peakDbfs: -Infinity, rmsDbfs: -Infinity }],
      }
    );
  }

  setMonitoring(request: SetLoopMonitoringRequest): void {
    const audioContext = this.getAudioContext();
    const source = audioContext.createMediaStreamSource(request.stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = INPUT_METER_FFT_SIZE;
    analyser.smoothingTimeConstant = 0;
    const meterRuntime = new AudioMeterRuntime({
      analyser: new WebAudioWaveformAnalyser(analyser),
      getCurrentTimeSeconds: () => audioContext.currentTime,
    });

    try {
      source.connect(analyser);
      if (request.destination) {
        source.connect(request.destination);
      }
    } catch (error) {
      source.disconnect();
      meterRuntime.dispose();
      throw error;
    }

    this.#monitorSource?.disconnect();
    this.#inputMeterRuntime?.dispose();
    this.#monitorSource = source;
    this.#inputMeterRuntime = meterRuntime;
  }
}
