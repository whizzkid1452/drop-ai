import { describe, expect, it } from 'vitest';
import { RegionRenderer } from './region-renderer';

const renderParams = {
  url: 'test.wav',
  startTime: 1,
  startOffset: 3,
  duration: 10,
};

describe('RegionRenderer.adjustForExportRange', () => {
  it('선택 범위의 양쪽에서 Region을 자른다', () => {
    expect(RegionRenderer.adjustForExportRange(renderParams, { startTime: 4, endTime: 8 })).toEqual({
      url: 'test.wav',
      startTime: 0,
      startOffset: 6,
      duration: 4,
    });
  });

  it('선택 범위 밖의 Region을 제외한다', () => {
    expect(RegionRenderer.adjustForExportRange(renderParams, { startTime: 20, endTime: 30 }).duration).toBe(0);
  });
});
