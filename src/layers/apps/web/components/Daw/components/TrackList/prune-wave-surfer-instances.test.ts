import { describe, expect, it } from 'vitest';
import type WaveSurfer from 'wavesurfer.js';
import { pruneWaveSurferInstances } from './prune-wave-surfer-instances';

const firstInstance = { name: 'first' } as unknown as WaveSurfer;
const secondInstance = { name: 'second' } as unknown as WaveSurfer;

describe('Track 목록 기반 WaveSurfer 참조 정리', () => {
  it('Agent나 CLI가 제거한 Track의 참조도 삭제한다', () => {
    const instances = new Map<string, WaveSurfer>([
      ['track-1', firstInstance],
      ['track-2', secondInstance],
    ]);

    const result = pruneWaveSurferInstances({
      instances,
      activeTrackIds: new Set(['track-2']),
    });

    expect(result).toEqual(new Map([['track-2', secondInstance]]));
    expect(instances.size).toBe(2);
  });

  it('제거된 Track이 없으면 기존 Map을 재사용한다', () => {
    const instances = new Map<string, WaveSurfer>([['track-1', firstInstance]]);

    const result = pruneWaveSurferInstances({
      instances,
      activeTrackIds: new Set(['track-1']),
    });

    expect(result).toBe(instances);
  });
});
