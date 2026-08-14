import { describe, expect, it } from "vitest";

import { MeterDSP, MeterType } from "./MeterDSP";

const SAMPLE_RATE = 48_000;
const RENDER_QUANTUM_FRAMES = 128;
const FIRST_LUFS_BLOCK_QUANTUM_COUNT = 38;

describe("MeterDSP LUFS 처리", () => {
  it("stereo 입력이 첫 100ms 블록 경계를 넘어도 처리를 완료한다", () => {
    const meter = new MeterDSP(MeterType.LUFS, SAMPLE_RATE, 2);
    const stereoBlock = [
      new Float32Array(RENDER_QUANTUM_FRAMES).fill(0.5),
      new Float32Array(RENDER_QUANTUM_FRAMES).fill(0.5),
    ];

    for (
      let quantumIndex = 0;
      quantumIndex < FIRST_LUFS_BLOCK_QUANTUM_COUNT;
      quantumIndex += 1
    ) {
      meter.processBlock(stereoBlock, RENDER_QUANTUM_FRAMES);
    }

    expect(meter.getLUFSReading().momentary).toBeGreaterThan(
      Number.NEGATIVE_INFINITY,
    );
  });
});
