function assertPowerOfTwo(value: number): void {
  if (value <= 0 || (value & (value - 1)) !== 0) {
    throw new RangeError("FFT input length must be a positive power of two");
  }
}

export function computeRealFftMagnitudes(
  input: Float32Array,
): Float64Array {
  const sampleCount = input.length;
  assertPowerOfTwo(sampleCount);

  const real = Float64Array.from(input);
  const imaginary = new Float64Array(sampleCount);

  applyBitReversalPermutation(real, imaginary);
  applyRadixTwoButterflies(real, imaginary);

  const positiveFrequencyBinCount = sampleCount / 2 + 1;
  return Float64Array.from(
    { length: positiveFrequencyBinCount },
    (_, binIndex) => Math.hypot(real[binIndex], imaginary[binIndex]),
  );
}

function applyBitReversalPermutation(
  real: Float64Array,
  imaginary: Float64Array,
): void {
  let reversedIndex = 0;

  for (let index = 1; index < real.length; index++) {
    let bit = real.length >>> 1;
    while ((reversedIndex & bit) !== 0) {
      reversedIndex ^= bit;
      bit >>>= 1;
    }
    reversedIndex ^= bit;

    if (index < reversedIndex) {
      [real[index], real[reversedIndex]] = [real[reversedIndex], real[index]];
      [imaginary[index], imaginary[reversedIndex]] = [
        imaginary[reversedIndex],
        imaginary[index],
      ];
    }
  }
}

function applyRadixTwoButterflies(
  real: Float64Array,
  imaginary: Float64Array,
): void {
  for (let transformSize = 2; transformSize <= real.length; transformSize *= 2) {
    const halfSize = transformSize / 2;
    const angleStep = (-2 * Math.PI) / transformSize;
    const stepReal = Math.cos(angleStep);
    const stepImaginary = Math.sin(angleStep);

    for (let startIndex = 0; startIndex < real.length; startIndex += transformSize) {
      let twiddleReal = 1;
      let twiddleImaginary = 0;

      // 각 stage에서 삼각함수를 반복 호출하지 않도록 twiddle factor를 점화식으로 갱신한다.
      for (let offset = 0; offset < halfSize; offset++) {
        const leftIndex = startIndex + offset;
        const rightIndex = leftIndex + halfSize;
        const transformedReal =
          twiddleReal * real[rightIndex] -
          twiddleImaginary * imaginary[rightIndex];
        const transformedImaginary =
          twiddleReal * imaginary[rightIndex] +
          twiddleImaginary * real[rightIndex];

        real[rightIndex] = real[leftIndex] - transformedReal;
        imaginary[rightIndex] = imaginary[leftIndex] - transformedImaginary;
        real[leftIndex] += transformedReal;
        imaginary[leftIndex] += transformedImaginary;

        const nextTwiddleReal =
          twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary =
          twiddleReal * stepImaginary + twiddleImaginary * stepReal;
        twiddleReal = nextTwiddleReal;
      }
    }
  }
}
