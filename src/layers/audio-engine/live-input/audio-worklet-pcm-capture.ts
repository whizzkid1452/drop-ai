import type { CapturedPcm, ILivePcmCapture, SchedulePcmCaptureRequest, ScheduledPcmCapture } from './live-pcm-capture';
import { PcmRingBuffer } from './pcm-ring-buffer';

const PCM_CAPTURE_PROCESSOR_NAME = 'loop-pcm-capture';
const PCM_CAPTURE_WORKLET_URL = '/loop-pcm-capture-worklet.js';
const moduleLoads = new WeakMap<AudioContext, Promise<void>>();

interface PcmCaptureStartedMessage {
  readonly type: 'started';
}

interface PcmCaptureChunkMessage {
  readonly channels: Float32Array[];
  readonly type: 'chunk';
}

interface PcmCaptureCompleteMessage {
  readonly type: 'complete';
}

type PcmCaptureMessage = PcmCaptureChunkMessage | PcmCaptureCompleteMessage | PcmCaptureStartedMessage;

function loadCaptureModule(audioContext: AudioContext): Promise<void> {
  const currentLoad = moduleLoads.get(audioContext);
  if (currentLoad) {
    return currentLoad;
  }

  const nextLoad = audioContext.audioWorklet.addModule(PCM_CAPTURE_WORKLET_URL);
  moduleLoads.set(audioContext, nextLoad);
  return nextLoad;
}

export class AudioWorkletPcmCapture implements ILivePcmCapture {
  async schedule(request: SchedulePcmCaptureRequest): Promise<ScheduledPcmCapture> {
    await loadCaptureModule(request.audioContext);

    const source = request.audioContext.createMediaStreamSource(request.stream);
    const worklet = new AudioWorkletNode(request.audioContext, PCM_CAPTURE_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    const silentGain = request.audioContext.createGain();
    silentGain.gain.value = 0;
    source.connect(worklet);
    worklet.connect(silentGain);
    silentGain.connect(request.audioContext.destination);

    const capacityFrames = Math.max(1, Math.round(request.durationSeconds * request.audioContext.sampleRate));
    let ringBuffer: PcmRingBuffer | null = null;
    let isSettled = false;
    let resolveCompletion: ((capturedPcm: CapturedPcm) => void) | undefined;
    let rejectCompletion: ((error: Error) => void) | undefined;
    const completion = new Promise<CapturedPcm>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });

    const cleanup = (): void => {
      source.disconnect();
      worklet.disconnect();
      silentGain.disconnect();
      worklet.port.onmessage = null;
    };
    const rejectAndCleanup = (error: Error): void => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      cleanup();
      rejectCompletion?.(error);
    };
    const resolveAndCleanup = (): void => {
      if (isSettled) {
        return;
      }
      if (ringBuffer === null) {
        rejectAndCleanup(new Error('캡처한 PCM 프레임이 없습니다.'));
        return;
      }
      isSettled = true;
      const channels = ringBuffer.readChannels();
      cleanup();
      resolveCompletion?.({ channels, sampleRate: request.audioContext.sampleRate });
    };

    worklet.port.onmessage = (event: MessageEvent<PcmCaptureMessage>): void => {
      try {
        if (event.data.type === 'started') {
          request.onStarted();
          return;
        }
        if (event.data.type === 'complete') {
          resolveAndCleanup();
          return;
        }

        ringBuffer ??= new PcmRingBuffer({
          capacityFrames,
          channelCount: event.data.channels.length,
        });
        ringBuffer.write(event.data.channels);
      } catch (error: unknown) {
        rejectAndCleanup(error instanceof Error ? error : new Error(String(error)));
      }
    };

    const startFrame = Math.round(request.startTimeSeconds * request.audioContext.sampleRate);
    worklet.port.postMessage({
      endFrame: startFrame + capacityFrames,
      startFrame,
      type: 'schedule',
    });

    return {
      cancel: () => {
        if (isSettled) {
          return;
        }
        worklet.port.postMessage({ type: 'cancel' });
        rejectAndCleanup(new Error('PCM 캡처가 취소되었습니다.'));
      },
      completion,
    };
  }
}
