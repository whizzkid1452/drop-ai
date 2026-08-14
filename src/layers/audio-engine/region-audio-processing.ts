interface StripSilenceFromPcmChannelsRequest {
  readonly channels: readonly Float32Array[];
  readonly minimumSilenceFrames: number;
  readonly thresholdLinear: number;
}

interface TimeStretchPcmChannelsRequest {
  readonly channels: readonly Float32Array[];
  readonly stretchRatio: number;
}

interface PitchShiftPcmChannelsRequest {
  readonly channels: readonly Float32Array[];
  readonly semitones: number;
}

interface DetectTransientPositionsRequest {
  readonly channels: readonly Float32Array[];
  readonly sampleRate: number;
  readonly sensitivity: number;
}

const MIN_STRETCH_RATIO = 0.25;
const MAX_STRETCH_RATIO = 4;
const MAX_PITCH_SHIFT_SEMITONES = 24;
const MIN_TRANSIENT_INTERVAL_SECONDS = 0.02;
const MAX_GRAIN_SIZE = 2_048;

export function analyzePcmPeak(channels: readonly Float32Array[]): number {
  let peak = 0;
  channels.forEach(channel => {
    channel.forEach(sample => {
      peak = Math.max(peak, Math.abs(sample));
    });
  });
  return peak;
}

export function reversePcmChannels(channels: readonly Float32Array[]): Float32Array[] {
  return channels.map(channel => Float32Array.from(channel).reverse());
}

export function stripSilenceFromPcmChannels({
  channels,
  minimumSilenceFrames,
  thresholdLinear,
}: StripSilenceFromPcmChannelsRequest): Float32Array[] {
  const frameCount = validatePcmChannels(channels);
  if (!Number.isSafeInteger(minimumSilenceFrames) || minimumSilenceFrames <= 0) {
    throw new RangeError('최소 무음 길이는 1 frame 이상의 정수여야 합니다.');
  }
  if (!Number.isFinite(thresholdLinear) || thresholdLinear < 0) {
    throw new RangeError('무음 임계값은 0 이상의 유한한 선형 진폭이어야 합니다.');
  }

  const removedFrames = new Uint8Array(frameCount);
  let silenceStartFrame: number | null = null;
  for (let frameIndex = 0; frameIndex <= frameCount; frameIndex += 1) {
    const isSilent =
      frameIndex < frameCount && channels.every(channel => Math.abs(channel[frameIndex] ?? 0) <= thresholdLinear);
    if (isSilent && silenceStartFrame === null) {
      silenceStartFrame = frameIndex;
      continue;
    }
    if (isSilent || silenceStartFrame === null) {
      continue;
    }

    if (frameIndex - silenceStartFrame >= minimumSilenceFrames) {
      removedFrames.fill(1, silenceStartFrame, frameIndex);
    }
    silenceStartFrame = null;
  }

  const retainedFrameCount = frameCount - removedFrames.reduce((count, isRemoved) => count + isRemoved, 0);
  return channels.map(channel => {
    const output = new Float32Array(retainedFrameCount);
    let outputFrameIndex = 0;
    channel.forEach((sample, frameIndex) => {
      if (removedFrames[frameIndex] === 0) {
        output[outputFrameIndex] = sample;
        outputFrameIndex += 1;
      }
    });
    return output;
  });
}

export function timeStretchPcmChannels({ channels, stretchRatio }: TimeStretchPcmChannelsRequest): Float32Array[] {
  const frameCount = validatePcmChannels(channels);
  validateStretchRatio(stretchRatio);
  const outputFrameCount = Math.max(1, Math.round(frameCount * stretchRatio));
  const grainSize = Math.min(MAX_GRAIN_SIZE, Math.max(2, frameCount));
  const inputHopSize = Math.max(1, Math.floor(grainSize / 4));
  const outputHopSize = Math.max(1, Math.round(inputHopSize * stretchRatio));
  const outputChannels = channels.map(() => new Float32Array(outputFrameCount));
  const accumulatedWeights = new Float32Array(outputFrameCount);

  // 입력 grain의 재생 속도는 유지하고 배치 간격만 바꿔 pitch 변화를 줄인다.
  for (let inputStartFrame = 0, outputStartFrame = 0; inputStartFrame < frameCount; ) {
    mixGrain({
      accumulatedWeights,
      channels,
      grainSize,
      inputStartFrame,
      outputChannels,
      outputStartFrame,
    });
    inputStartFrame += inputHopSize;
    outputStartFrame += outputHopSize;
  }

  return normalizeOverlapAddedChannels({
    accumulatedWeights,
    inputChannels: channels,
    outputChannels,
    stretchRatio,
  });
}

export function pitchShiftPcmChannels({ channels, semitones }: PitchShiftPcmChannelsRequest): Float32Array[] {
  const frameCount = validatePcmChannels(channels);
  if (!Number.isFinite(semitones) || Math.abs(semitones) > MAX_PITCH_SHIFT_SEMITONES) {
    throw new RangeError(
      `Pitch shift는 ${-MAX_PITCH_SHIFT_SEMITONES}~${MAX_PITCH_SHIFT_SEMITONES} semitone이어야 합니다.`
    );
  }
  if (semitones === 0) {
    return channels.map(channel => Float32Array.from(channel));
  }

  const pitchRatio = Math.pow(2, semitones / 12);
  const resampledFrameCount = Math.max(1, Math.round(frameCount / pitchRatio));
  const resampledChannels = resamplePcmChannels(channels, resampledFrameCount);
  const shiftedChannels = timeStretchPcmChannels({
    channels: resampledChannels,
    stretchRatio: frameCount / resampledFrameCount,
  });
  return resizePcmChannels(shiftedChannels, frameCount);
}

export function detectTransientPositionsSeconds({
  channels,
  sampleRate,
  sensitivity,
}: DetectTransientPositionsRequest): number[] {
  const frameCount = validatePcmChannels(channels);
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError('Sample rate는 0보다 큰 유한한 수여야 합니다.');
  }
  if (!Number.isFinite(sensitivity) || sensitivity <= 0 || sensitivity > 1) {
    throw new RangeError('Transient sensitivity는 0보다 크고 1 이하여야 합니다.');
  }

  const framePeaks = Float32Array.from({ length: frameCount }, (_, frameIndex) =>
    channels.reduce((peak, channel) => Math.max(peak, Math.abs(channel[frameIndex] ?? 0)), 0)
  );
  const peak = analyzePcmPeak(channels);
  const triggerThreshold = peak * Math.max(0.02, 1 - sensitivity);
  const minimumIntervalFrames = Math.max(1, Math.round(sampleRate * MIN_TRANSIENT_INTERVAL_SECONDS));
  const positionsSeconds: number[] = [];
  let lastTransientFrame = -minimumIntervalFrames;

  framePeaks.forEach((framePeak, frameIndex) => {
    const previousPeak = framePeaks[frameIndex - 1] ?? 0;
    const isOnset = framePeak > triggerThreshold && previousPeak <= triggerThreshold;
    if (isOnset && frameIndex - lastTransientFrame >= minimumIntervalFrames) {
      positionsSeconds.push(frameIndex / sampleRate);
      lastTransientFrame = frameIndex;
    }
  });
  return positionsSeconds;
}

interface MixGrainRequest {
  readonly accumulatedWeights: Float32Array;
  readonly channels: readonly Float32Array[];
  readonly grainSize: number;
  readonly inputStartFrame: number;
  readonly outputChannels: Float32Array[];
  readonly outputStartFrame: number;
}

function mixGrain({
  accumulatedWeights,
  channels,
  grainSize,
  inputStartFrame,
  outputChannels,
  outputStartFrame,
}: MixGrainRequest): void {
  for (let grainFrame = 0; grainFrame < grainSize; grainFrame += 1) {
    const inputFrame = inputStartFrame + grainFrame;
    const outputFrame = outputStartFrame + grainFrame;
    if (inputFrame >= channels[0]!.length || outputFrame >= accumulatedWeights.length) {
      break;
    }
    const weight = grainSize === 2 ? 1 : 0.5 - 0.5 * Math.cos((2 * Math.PI * grainFrame) / (grainSize - 1));
    accumulatedWeights[outputFrame] = (accumulatedWeights[outputFrame] ?? 0) + weight;
    outputChannels.forEach((outputChannel, channelIndex) => {
      outputChannel[outputFrame] =
        (outputChannel[outputFrame] ?? 0) + (channels[channelIndex]?.[inputFrame] ?? 0) * weight;
    });
  }
}

interface NormalizeOverlapAddedChannelsRequest {
  readonly accumulatedWeights: Float32Array;
  readonly inputChannels: readonly Float32Array[];
  readonly outputChannels: Float32Array[];
  readonly stretchRatio: number;
}

function normalizeOverlapAddedChannels({
  accumulatedWeights,
  inputChannels,
  outputChannels,
  stretchRatio,
}: NormalizeOverlapAddedChannelsRequest): Float32Array[] {
  return outputChannels.map((outputChannel, channelIndex) => {
    outputChannel.forEach((sample, outputFrame) => {
      const weight = accumulatedWeights[outputFrame] ?? 0;
      outputChannel[outputFrame] =
        weight > 0 ? sample / weight : interpolateSample(inputChannels[channelIndex]!, outputFrame / stretchRatio);
    });
    return outputChannel;
  });
}

function resamplePcmChannels(channels: readonly Float32Array[], outputFrameCount: number): Float32Array[] {
  const inputFrameCount = validatePcmChannels(channels);
  if (!Number.isSafeInteger(outputFrameCount) || outputFrameCount <= 0) {
    throw new RangeError('출력 frame 수는 1 이상의 정수여야 합니다.');
  }
  const sourceFramesPerOutputFrame = inputFrameCount / outputFrameCount;
  return channels.map(channel =>
    Float32Array.from({ length: outputFrameCount }, (_, frameIndex) =>
      interpolateSample(channel, frameIndex * sourceFramesPerOutputFrame)
    )
  );
}

function resizePcmChannels(channels: readonly Float32Array[], outputFrameCount: number): Float32Array[] {
  if (channels[0]?.length === outputFrameCount) {
    return channels.map(channel => Float32Array.from(channel));
  }
  return resamplePcmChannels(channels, outputFrameCount);
}

function interpolateSample(channel: Float32Array, framePosition: number): number {
  const previousFrame = Math.min(channel.length - 1, Math.max(0, Math.floor(framePosition)));
  const nextFrame = Math.min(channel.length - 1, previousFrame + 1);
  const interpolation = Math.max(0, Math.min(1, framePosition - previousFrame));
  return (channel[previousFrame] ?? 0) * (1 - interpolation) + (channel[nextFrame] ?? 0) * interpolation;
}

function validateStretchRatio(stretchRatio: number): void {
  if (!Number.isFinite(stretchRatio) || stretchRatio < MIN_STRETCH_RATIO || stretchRatio > MAX_STRETCH_RATIO) {
    throw new RangeError(`Time stretch 비율은 ${MIN_STRETCH_RATIO}~${MAX_STRETCH_RATIO}여야 합니다.`);
  }
}

function validatePcmChannels(channels: readonly Float32Array[]): number {
  const frameCount = channels[0]?.length ?? 0;
  if (channels.length === 0 || channels.some(channel => channel.length !== frameCount)) {
    throw new RangeError('PCM Channel은 하나 이상이며 길이가 모두 같아야 합니다.');
  }
  return frameCount;
}
