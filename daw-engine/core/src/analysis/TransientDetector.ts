/**
 * TransientDetector — spectral-flux based onset / transient detection.
 *
 * Uses a windowed FFT approach with spectral flux to identify percussive
 * onsets and transient events in audio data.  The algorithm:
 *
 *   1. Slide a Hann window across the signal (window size 1024, hop 512).
 *   2. Compute the magnitude spectrum via a real-valued FFT.
 *   3. For each frame, compute spectral flux — the sum of positive
 *      differences between the current and previous magnitude spectrum.
 *   4. Peak-pick: choose frames whose spectral flux exceeds a local
 *      threshold (median of a surrounding window, scaled by a sensitivity
 *      parameter).
 *
 * This is intentionally a pure-TypeScript implementation that runs without
 * Web Audio API so it can be used in headless / test environments.
 */

import { computeRealFftMagnitudes } from "./real-fft";

const DEFAULT_WINDOW_SIZE = 1024;
const DEFAULT_HOP_SIZE = 512;
const DEFAULT_THRESHOLD = 1.5;
const MEDIAN_WINDOW = 11; // frames around current for adaptive threshold

/**
 * Detect transient positions in a mono audio buffer.
 *
 * @param samples     Mono audio samples (Float32Array).
 * @param sampleRate  Sample rate of the audio (used only for documentation;
 *                    results are returned in sample frames).
 * @param threshold   Sensitivity multiplier (lower = more onsets). Default 1.5.
 * @returns           Sorted array of frame positions where transients occur.
 */
export function detectTransients(
  samples: Float32Array,
  sampleRate: number,
  threshold: number = DEFAULT_THRESHOLD,
): number[] {
  const windowSize = DEFAULT_WINDOW_SIZE;
  const hopSize = DEFAULT_HOP_SIZE;
  const halfWindow = windowSize >>> 1;

  if (samples.length < windowSize) {
    return [];
  }

  // Pre-compute Hann window
  const hann = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
  }

  const numFrames = Math.floor((samples.length - windowSize) / hopSize) + 1;
  const fluxValues: number[] = new Array(numFrames);

  let previousMagnitudes: ArrayLike<number> = new Float64Array(halfWindow + 1);

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize;

    // Apply Hann window
    const windowed = new Float32Array(windowSize);
    for (let i = 0; i < windowSize; i++) {
      windowed[i] = samples[offset + i] * hann[i];
    }

    const magnitudes = computeRealFftMagnitudes(windowed);

    // Spectral flux: sum of positive differences
    let flux = 0;
    for (let k = 0; k <= halfWindow; k++) {
      const diff = magnitudes[k] - previousMagnitudes[k];
      if (diff > 0) {
        flux += diff;
      }
    }
    fluxValues[frame] = flux;
    previousMagnitudes = magnitudes;
  }

  // Adaptive peak picking using a median-based threshold
  const transients: number[] = [];
  const halfMedian = (MEDIAN_WINDOW - 1) >>> 1;

  for (let frame = 0; frame < numFrames; frame++) {
    // Gather surrounding flux values for median computation
    const start = Math.max(0, frame - halfMedian);
    const end = Math.min(numFrames - 1, frame + halfMedian);
    const neighbourhood: number[] = [];
    for (let j = start; j <= end; j++) {
      neighbourhood.push(fluxValues[j]);
    }
    neighbourhood.sort((a, b) => a - b);
    const median = neighbourhood[neighbourhood.length >>> 1];

    if (fluxValues[frame] > median * threshold && fluxValues[frame] > 0) {
      // Convert frame index to sample position (center of hop)
      const samplePos = frame * hopSize + halfWindow;
      transients.push(samplePos);
    }
  }

  return transients;
}
