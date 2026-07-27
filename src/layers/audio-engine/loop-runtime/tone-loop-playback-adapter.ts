import * as Tone from 'tone';
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

  setMonitoring(request: SetLoopMonitoringRequest): void {
    this.#monitorSource?.disconnect();
    this.#monitorSource = null;
    if (request.destination === null) {
      return;
    }

    const source = this.getAudioContext().createMediaStreamSource(request.stream);
    source.connect(request.destination);
    this.#monitorSource = source;
  }
}
