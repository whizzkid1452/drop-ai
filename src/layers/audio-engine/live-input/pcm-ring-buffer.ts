export interface PcmRingBufferOptions {
  readonly capacityFrames: number;
  readonly channelCount: number;
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name}은 0보다 큰 정수여야 합니다.`);
  }
}

export class PcmRingBuffer {
  readonly #capacityFrames: number;
  readonly #channelBuffers: Float32Array[];
  #frameCount = 0;
  #writeIndex = 0;

  constructor(options: PcmRingBufferOptions) {
    assertPositiveInteger(options.capacityFrames, 'capacityFrames');
    assertPositiveInteger(options.channelCount, 'channelCount');

    this.#capacityFrames = options.capacityFrames;
    this.#channelBuffers = Array.from({ length: options.channelCount }, () => new Float32Array(options.capacityFrames));
  }

  get frameCount(): number {
    return this.#frameCount;
  }

  get isFull(): boolean {
    return this.#frameCount === this.#capacityFrames;
  }

  write(inputChannels: readonly Float32Array[]): void {
    this.#validateInputChannels(inputChannels);
    const inputFrameCount = inputChannels[0]?.length ?? 0;

    for (let frameIndex = 0; frameIndex < inputFrameCount; frameIndex += 1) {
      this.#writeFrame(inputChannels, frameIndex);
    }
  }

  readChannels(): Float32Array[] {
    const readStartIndex = this.isFull ? this.#writeIndex : 0;

    return this.#channelBuffers.map(channelBuffer => {
      const result = new Float32Array(this.#frameCount);
      for (let frameIndex = 0; frameIndex < this.#frameCount; frameIndex += 1) {
        result[frameIndex] = channelBuffer[(readStartIndex + frameIndex) % this.#capacityFrames];
      }
      return result;
    });
  }

  clear(): void {
    this.#channelBuffers.forEach(channelBuffer => channelBuffer.fill(0));
    this.#frameCount = 0;
    this.#writeIndex = 0;
  }

  #validateInputChannels(inputChannels: readonly Float32Array[]): void {
    if (inputChannels.length !== this.#channelBuffers.length) {
      throw new RangeError(`입력 채널 수는 ${this.#channelBuffers.length}개여야 합니다.`);
    }

    const inputFrameCount = inputChannels[0]?.length ?? 0;
    if (inputChannels.some(channel => channel.length !== inputFrameCount)) {
      throw new RangeError('모든 입력 채널의 프레임 수가 같아야 합니다.');
    }
  }

  #writeFrame(inputChannels: readonly Float32Array[], inputFrameIndex: number): void {
    this.#channelBuffers.forEach((channelBuffer, channelIndex) => {
      channelBuffer[this.#writeIndex] = inputChannels[channelIndex][inputFrameIndex];
    });

    this.#writeIndex = (this.#writeIndex + 1) % this.#capacityFrames;
    this.#frameCount = Math.min(this.#frameCount + 1, this.#capacityFrames);
  }
}
