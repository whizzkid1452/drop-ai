/* global AudioWorkletProcessor, currentFrame, registerProcessor */

const PROCESSOR_NAME = 'loop-pcm-capture';

class LoopPcmCaptureProcessor extends AudioWorkletProcessor {
  endFrame = null;
  hasStarted = false;
  startFrame = null;

  constructor() {
    super();
    this.port.onmessage = event => {
      if (event.data.type === 'cancel') {
        this.endFrame = null;
        this.startFrame = null;
        return;
      }
      if (event.data.type === 'schedule') {
        this.endFrame = event.data.endFrame;
        this.hasStarted = false;
        this.startFrame = event.data.startFrame;
      }
    };
  }

  process(inputs) {
    const inputChannels = inputs[0];
    const blockFrameCount = inputChannels[0]?.length ?? 0;
    if (this.startFrame === null || this.endFrame === null || blockFrameCount === 0) {
      return true;
    }

    const blockEndFrame = currentFrame + blockFrameCount;
    if (blockEndFrame <= this.startFrame || currentFrame >= this.endFrame) {
      return true;
    }
    if (!this.hasStarted) {
      this.hasStarted = true;
      this.port.postMessage({ type: 'started' });
    }

    const captureStartIndex = Math.max(0, this.startFrame - currentFrame);
    const captureEndIndex = Math.min(blockFrameCount, this.endFrame - currentFrame);
    const channels = inputChannels.map(channel => channel.slice(captureStartIndex, captureEndIndex));
    this.port.postMessage(
      { channels, type: 'chunk' },
      channels.map(channel => channel.buffer)
    );

    if (blockEndFrame >= this.endFrame) {
      this.endFrame = null;
      this.startFrame = null;
      this.port.postMessage({ type: 'complete' });
    }
    return true;
  }
}

registerProcessor(PROCESSOR_NAME, LoopPcmCaptureProcessor);
