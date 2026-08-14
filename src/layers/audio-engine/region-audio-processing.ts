interface StripSilenceFromPcmChannelsRequest {
  readonly channels: readonly Float32Array[];
  readonly minimumSilenceFrames: number;
  readonly thresholdLinear: number;
}

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

function validatePcmChannels(channels: readonly Float32Array[]): number {
  const frameCount = channels[0]?.length ?? 0;
  if (channels.length === 0 || channels.some(channel => channel.length !== frameCount)) {
    throw new RangeError('PCM Channel은 하나 이상이며 길이가 모두 같아야 합니다.');
  }
  return frameCount;
}
