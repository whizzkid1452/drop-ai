import { describe, expect, it } from "vitest";

import { computeRealFftMagnitudes } from "./real-fft";

describe("computeRealFftMagnitudes", () => {
  it("실수 신호의 양의 주파수 magnitude를 계산한다", () => {
    const magnitudes = computeRealFftMagnitudes(
      new Float32Array([0, 1, 0, -1, 0, 1, 0, -1]),
    );

    expect(magnitudes).toHaveLength(5);
    expect(magnitudes[0]).toBeCloseTo(0);
    expect(magnitudes[1]).toBeCloseTo(0);
    expect(magnitudes[2]).toBeCloseTo(4);
    expect(magnitudes[3]).toBeCloseTo(0);
    expect(magnitudes[4]).toBeCloseTo(0);
  });
});
