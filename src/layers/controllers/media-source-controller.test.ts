import { describe, expect, it, vi } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { AudioSourceRegistry } from '../audio-source-registry/audio-source-registry';
import type { AudioSourceRegistration } from '../audio-source-registry/i-audio-source-registry';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import { MediaSourceController } from './media-source-controller';

const USED_SOURCE_ID = '11111111-1111-4111-8111-111111111111';
const UNUSED_SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const REGION_ID = '33333333-3333-4333-8333-333333333333';

function createRegistration(sourceId: string): AudioSourceRegistration {
  return {
    blob: new Blob([sourceId], { type: 'audio/wav' }),
    metadata: {
      bwfMetadata: null,
      byteLength: sourceId.length,
      derivation: null,
      durationSeconds: 1,
      fileName: `${sourceId}.wav`,
      id: sourceId,
      mimeType: 'audio/wav',
      tags: [],
      transientPositionsSeconds: [],
    },
  };
}

function createTestContext() {
  const audioEngine = new MockAudioEngine();
  const audioSourceRegistry = new AudioSourceRegistry({
    createObjectUrl: blob => `blob:${blob.size}:${crypto.randomUUID()}`,
    revokeObjectUrl: vi.fn(),
  });
  const audioSourceRepository: IAudioSourceRepository = {
    create: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
  };
  const controller = new MediaSourceController({ audioEngine, audioSourceRegistry, audioSourceRepository });
  return { audioEngine, audioSourceRegistry, audioSourceRepository, controller };
}

describe('MediaSourceController', () => {
  it('tag의 앞뒤 공백과 중복을 제거해 Source metadata에 저장한다', () => {
    const { audioSourceRegistry, controller } = createTestContext();
    audioSourceRegistry.restoreCommitted(createRegistration(USED_SOURCE_ID));

    controller.setSourceTags({ sourceId: USED_SOURCE_ID, tags: [' vocal ', 'lead', 'vocal', ' '] });

    expect(audioSourceRegistry.resolve(USED_SOURCE_ID)?.metadata).toMatchObject({ tags: ['vocal', 'lead'] });
  });

  it('Source Blob을 runtime audition에 전달하고 중지한다', async () => {
    const { audioEngine, audioSourceRegistry, controller } = createTestContext();
    const registration = createRegistration(USED_SOURCE_ID);
    audioSourceRegistry.restoreCommitted(registration);

    await controller.auditionSource(USED_SOURCE_ID);

    expect(audioEngine.getMockAuditionBlob()).toBe(registration.blob);
    controller.stopAudition();
    expect(audioEngine.getMockAuditionBlob()).toBeNull();
  });

  it('Region과 Loop Slot에 연결되지 않은 Source만 runtime과 저장소에서 제거한다', async () => {
    const { audioSourceRegistry, audioSourceRepository, controller } = createTestContext();
    audioSourceRegistry.restoreCommitted(createRegistration(USED_SOURCE_ID));
    audioSourceRegistry.restoreCommitted(createRegistration(UNUSED_SOURCE_ID));
    audioSourceRegistry.attach({ regionId: REGION_ID, sourceId: USED_SOURCE_ID });

    const result = await controller.cleanupUnusedSources();

    expect(result.removedSourceIds).toEqual([UNUSED_SOURCE_ID]);
    expect(audioSourceRegistry.resolve(USED_SOURCE_ID)).not.toBeNull();
    expect(audioSourceRegistry.resolve(UNUSED_SOURCE_ID)).toBeNull();
    expect(audioSourceRepository.delete).toHaveBeenCalledWith(UNUSED_SOURCE_ID);
  });

  it('저장소 삭제 실패 시 제거한 runtime Source를 복구한다', async () => {
    const { audioSourceRegistry, audioSourceRepository, controller } = createTestContext();
    const registration = createRegistration(UNUSED_SOURCE_ID);
    audioSourceRegistry.restoreCommitted(registration);
    vi.mocked(audioSourceRepository.delete).mockRejectedValueOnce(new Error('OPFS 삭제 실패'));

    await expect(controller.cleanupUnusedSources()).rejects.toThrow('OPFS 삭제 실패');

    expect(audioSourceRegistry.resolve(UNUSED_SOURCE_ID)).not.toBeNull();
    expect(audioSourceRepository.create).not.toHaveBeenCalled();
  });
});
