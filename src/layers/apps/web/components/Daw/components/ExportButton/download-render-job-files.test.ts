// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { downloadRenderJobFiles } from './download-render-job-files';
import { downloadBlob } from './utils/audioExport';

vi.mock('./utils/audioExport', () => ({ downloadBlob: vi.fn() }));

describe('downloadRenderJobFiles', () => {
  it('RenderJob이 완성한 파일만 지정 이름으로 내려받는다', () => {
    const files = [
      {
        analysis: {
          integratedLufs: -14,
          loudnessRangeLu: 3,
          normalizationGainDb: 0,
          samplePeakDbfs: -1,
          truePeakDbtp: -1,
        },
        blob: new Blob(['mix']),
        fileName: 'Mix.wav',
        rangeId: 'range-1',
        trackId: null,
      },
    ];

    downloadRenderJobFiles({ files, jobId: 'job-1' });

    expect(downloadBlob).toHaveBeenCalledWith(files[0]?.blob, 'Mix.wav');
  });
});
