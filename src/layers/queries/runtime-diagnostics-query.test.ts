import { describe, expect, it, vi } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { RuntimeDiagnosticsQuery } from './runtime-diagnostics-query';

describe('RuntimeDiagnosticsQuery', () => {
  it('AudioContext·정리 대기·저장소 사용량·탭 상태를 한 snapshot으로 읽는다', async () => {
    const audioEngine = new MockAudioEngine();
    audioEngine.setMockRuntimeHealth({ audioContextState: 'suspended', pendingCleanupResourceCount: 2 });
    const query = new RuntimeDiagnosticsQuery({
      audioEngine,
      estimateStorage: async () => ({ quota: 1_000, usage: 850 }),
      now: () => '2026-08-14T00:00:00.000Z',
      readVisibility: () => 'hidden',
    });

    await expect(query.refresh()).resolves.toEqual({
      audioContextState: 'suspended',
      checkedAt: '2026-08-14T00:00:00.000Z',
      dspLoadRatio: null,
      lastOfflineRenderRealtimeRatio: null,
      pendingCleanupResourceCount: 2,
      storage: { quotaBytes: 1_000, status: 'warning', usageBytes: 850, usageRatio: 0.85 },
      visibilityState: 'hidden',
    });
  });

  it('저장소 조회 실패를 진단 전체 실패로 전파하지 않는다', async () => {
    const listener = vi.fn();
    const query = new RuntimeDiagnosticsQuery({
      audioEngine: new MockAudioEngine(),
      estimateStorage: async () => {
        throw new DOMException('차단됨', 'SecurityError');
      },
    });
    query.subscribe(listener);

    const state = await query.refresh();

    expect(state.storage.status).toBe('unavailable');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
