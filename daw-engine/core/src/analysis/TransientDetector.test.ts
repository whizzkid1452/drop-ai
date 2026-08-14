import { describe, expect, it } from "vitest";

import { detectTransients } from "./TransientDetector";

const SAMPLE_RATE = 48_000;
const BURST_LENGTH_FRAMES = 64;

function addPercussiveBurst(samples: Float32Array, startFrame: number): void {
  for (let frameOffset = 0; frameOffset < BURST_LENGTH_FRAMES; frameOffset++) {
    const polarity = frameOffset % 2 === 0 ? 1 : -1;
    samples[startFrame + frameOffset] =
      (1 - frameOffset / BURST_LENGTH_FRAMES) * polarity;
  }
}

describe("detectTransients", () => {
  it("percussive burst의 기존 transient 위치를 유지한다", () => {
    const samples = new Float32Array(SAMPLE_RATE);
    [6_000, 18_000, 36_000].forEach((startFrame) =>
      addPercussiveBurst(samples, startFrame),
    );

    expect(detectTransients(samples, SAMPLE_RATE)).toEqual([
      5_632, 6_144, 17_920, 35_840,
    ]);
  });
});
