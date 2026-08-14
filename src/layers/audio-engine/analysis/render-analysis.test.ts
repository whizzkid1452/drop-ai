import { describe, expect, it } from 'vitest';
import { analyzeRenderedPcm, calculateNormalizationGainDb } from './render-analysis';

describe('render analysis', () => {
  it('PCM의 sample peak, true peak 추정값, integrated loudness를 dB로 반환한다', () => {
    const sampleRate = 48_000;
    const channel = Float32Array.from(
      { length: sampleRate },
      (_, index) => Math.sin((2 * Math.PI * 1_000 * index) / sampleRate) * 0.5
    );

    const result = analyzeRenderedPcm({ channels: [channel], sampleRate });

    expect(result.samplePeakDbfs).toBeCloseTo(-6.02, 1);
    expect(result.truePeakDbtp).toBeGreaterThanOrEqual(result.samplePeakDbfs);
    expect(result.integratedLufs).toBeGreaterThan(-20);
    expect(result.integratedLufs).toBeLessThan(-5);
    expect(result.loudnessRangeLu).toBeCloseTo(0, 1);
  });

  it('무음은 음의 무한대 loudness와 0 LU loudness range를 반환한다', () => {
    const result = analyzeRenderedPcm({ channels: [new Float32Array(48_000)], sampleRate: 48_000 });

    expect(result.samplePeakDbfs).toBe(Number.NEGATIVE_INFINITY);
    expect(result.truePeakDbtp).toBe(Number.NEGATIVE_INFINITY);
    expect(result.integratedLufs).toBe(Number.NEGATIVE_INFINITY);
    expect(result.loudnessRangeLu).toBe(0);
  });

  it('peak와 LUFS normalization 목표까지 필요한 gain을 계산한다', () => {
    const analysis = {
      integratedLufs: -18,
      loudnessRangeLu: 4,
      normalizationGainDb: 0,
      samplePeakDbfs: -8,
      truePeakDbtp: -7.5,
    };

    expect(calculateNormalizationGainDb({ analysis, normalization: { mode: 'peak', targetDbfs: -1 } })).toBe(6.5);
    expect(calculateNormalizationGainDb({ analysis, normalization: { mode: 'lufs', targetLufs: -14 } })).toBe(4);
    expect(calculateNormalizationGainDb({ analysis, normalization: { mode: 'none' } })).toBe(0);
  });
});
