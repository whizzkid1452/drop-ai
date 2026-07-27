import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectAudioSource } from '../shared/types/project-document.schema';
import { AudioSourceRegistry } from './audio-source-registry';
import { BrowserObjectUrlAdapter } from './browser-object-url-adapter';
import { AudioSourceRegistryError, type AudioSourceRegistryErrorCode } from './errors';
import type { AudioSourceRegistration } from './i-audio-source-registry';
import type { IObjectUrlAdapter } from './i-object-url-adapter';

const SOURCE_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const REGION_ID = '33333333-3333-4333-8333-333333333333';
const THIRD_SOURCE_ID = '44444444-4444-4444-8444-444444444444';
const LOOP_SLOT_ID = '55555555-5555-4555-8555-555555555555';

class FakeObjectUrlAdapter implements IObjectUrlAdapter {
  private nextUrlIndex = 0;

  readonly createObjectUrl = vi.fn((blob: Blob): string => {
    void blob;
    this.nextUrlIndex += 1;
    return `blob:test-${this.nextUrlIndex}`;
  });

  readonly revokeObjectUrl = vi.fn((objectUrl: string): void => {
    void objectUrl;
  });
}

function createRegistration(sourceId = SOURCE_ID): AudioSourceRegistration {
  const blob = new Blob(['test'], { type: 'audio/wav' });

  return {
    metadata: {
      id: sourceId,
      fileName: 'voice.wav',
      mimeType: blob.type,
      byteLength: blob.size,
      durationSeconds: 1,
    },
    blob,
  };
}

function expectRegistryError(action: () => unknown, code: AudioSourceRegistryErrorCode): AudioSourceRegistryError {
  let thrownError: unknown;

  try {
    action();
  } catch (error) {
    thrownError = error;
  }

  expect(thrownError).toBeInstanceOf(AudioSourceRegistryError);
  expect(thrownError).toMatchObject({ code });
  return thrownError as AudioSourceRegistryError;
}

describe('AudioSourceRegistry', () => {
  let objectUrlAdapter: FakeObjectUrlAdapter;
  let registry: AudioSourceRegistry;

  beforeEach(() => {
    objectUrlAdapter = new FakeObjectUrlAdapter();
    registry = new AudioSourceRegistry(objectUrlAdapter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('같은 루프 슬롯에 여러 Source 레이어를 독립적으로 연결한다', () => {
    registry.stage(createRegistration(SOURCE_ID));
    registry.stage(createRegistration(SECOND_SOURCE_ID));

    registry.attachLoopSlot({ loopSlotId: LOOP_SLOT_ID, sourceId: SOURCE_ID });
    registry.attachLoopSlot({ loopSlotId: LOOP_SLOT_ID, sourceId: SECOND_SOURCE_ID });
    registry.detachLoopSlot({ loopSlotId: LOOP_SLOT_ID, sourceId: SOURCE_ID });

    expect(registry.resolve(SOURCE_ID)?.loopSlotIds).toEqual([]);
    expect(registry.resolve(SECOND_SOURCE_ID)?.loopSlotIds).toEqual([LOOP_SLOT_ID]);
  });

  it('Source를 pending 상태로 등록하고 외부에 복사본만 반환한다', () => {
    const registration = createRegistration();

    const stagedSource = registry.stage(registration);
    registration.metadata.fileName = '외부 변경.wav';
    (stagedSource.metadata as ProjectAudioSource).fileName = '반환값 변경.wav';
    (stagedSource.regionIds as string[]).push(REGION_ID);

    expect(registry.resolve(SOURCE_ID)).toEqual({
      metadata: {
        id: SOURCE_ID,
        fileName: 'voice.wav',
        mimeType: 'audio/wav',
        byteLength: 4,
        durationSeconds: 1,
      },
      objectUrl: 'blob:test-1',
      isCommitted: false,
      regionIds: [],
      loopSlotIds: [],
    });
    expect(objectUrlAdapter.createObjectUrl).toHaveBeenCalledWith(registration.blob);
  });

  it('존재하지 않는 Source 조회는 null을 반환한다', () => {
    expect(registry.resolve(SOURCE_ID)).toBeNull();
  });

  it('잘못된 Source metadata를 Object URL 생성 전에 거부한다', () => {
    const registration = createRegistration();
    const invalidRegistration = {
      ...registration,
      metadata: { ...registration.metadata, id: 'invalid-source-id' },
    } as AudioSourceRegistration;

    expectRegistryError(() => registry.stage(invalidRegistration), 'INVALID_SOURCE_METADATA');

    expect(objectUrlAdapter.createObjectUrl).not.toHaveBeenCalled();
  });

  it('metadata와 Blob의 byteLength가 다르면 등록을 거부한다', () => {
    const registration = createRegistration();
    const mismatchedRegistration = {
      ...registration,
      metadata: { ...registration.metadata, byteLength: registration.blob.size + 1 },
    };

    expectRegistryError(() => registry.stage(mismatchedRegistration), 'SOURCE_BYTE_LENGTH_MISMATCH');

    expect(objectUrlAdapter.createObjectUrl).not.toHaveBeenCalled();
  });

  it('Blob이 아닌 런타임 입력을 Object URL 생성 전에 거부한다', () => {
    const registration = createRegistration();
    const invalidRegistration = { ...registration, blob: { size: registration.blob.size } as Blob };

    expectRegistryError(() => registry.stage(invalidRegistration), 'INVALID_SOURCE_BLOB');

    expect(objectUrlAdapter.createObjectUrl).not.toHaveBeenCalled();
    expect(registry.resolve(SOURCE_ID)).toBeNull();
  });

  it('중복 Source ID를 기존 Source 교체 없이 거부한다', () => {
    registry.stage(createRegistration());

    expectRegistryError(() => registry.stage(createRegistration()), 'SOURCE_ID_CONFLICT');

    expect(objectUrlAdapter.createObjectUrl).toHaveBeenCalledTimes(1);
    expect(registry.resolve(SOURCE_ID)?.objectUrl).toBe('blob:test-1');
  });

  it('Object URL 생성 실패를 typed error로 반환하고 Source를 남기지 않는다', () => {
    const creationError = new Error('URL 생성 실패');
    objectUrlAdapter.createObjectUrl.mockImplementationOnce(() => {
      throw creationError;
    });

    const error = expectRegistryError(() => registry.stage(createRegistration()), 'OBJECT_URL_CREATION_FAILED');

    expect(error.cause).toBe(creationError);
    expect(registry.resolve(SOURCE_ID)).toBeNull();
  });

  it('비어 있는 Object URL을 생성 실패로 처리한다', () => {
    objectUrlAdapter.createObjectUrl.mockReturnValueOnce('');

    expectRegistryError(() => registry.stage(createRegistration()), 'OBJECT_URL_CREATION_FAILED');

    expect(registry.resolve(SOURCE_ID)).toBeNull();
  });

  it('Region을 연결하면 Source를 committed 상태로 바꾸고 목록에 포함한다', () => {
    const registration = createRegistration();
    registry.stage(registration);

    registry.attach({ sourceId: SOURCE_ID, regionId: REGION_ID });

    expect(registry.resolve(SOURCE_ID)).toMatchObject({
      isCommitted: true,
      regionIds: [REGION_ID],
    });
    expect(registry.listCommittedMetadata()).toEqual([createRegistration().metadata]);
    expect(registry.listCommittedRegistrations()).toEqual([
      {
        metadata: createRegistration().metadata,
        blob: registration.blob,
      },
    ]);
  });

  it('저장용 목록은 pending Source를 제외하고 metadata 복사본과 원본 Blob을 반환한다', () => {
    const committedRegistration = createRegistration();
    registry.restoreCommitted(committedRegistration);
    registry.stage(createRegistration(SECOND_SOURCE_ID));

    const registrations = registry.listCommittedRegistrations();
    (registrations[0].metadata as ProjectAudioSource).fileName = '반환값 변경.wav';

    expect(registrations).toHaveLength(1);
    expect(registrations[0].blob).toBe(committedRegistration.blob);
    expect(registry.listCommittedRegistrations()[0].metadata.fileName).toBe('voice.wav');
  });

  it('잘못된 Region ID와 중복 Region 연결을 거부한다', () => {
    registry.stage(createRegistration());
    registry.stage(createRegistration(SECOND_SOURCE_ID));

    expectRegistryError(
      () => registry.attach({ sourceId: SOURCE_ID, regionId: 'invalid-region-id' }),
      'INVALID_REGION_ID'
    );

    registry.attach({ sourceId: SOURCE_ID, regionId: REGION_ID });

    expectRegistryError(() => registry.attach({ sourceId: SOURCE_ID, regionId: REGION_ID }), 'REGION_ID_CONFLICT');
    expectRegistryError(
      () => registry.attach({ sourceId: SECOND_SOURCE_ID, regionId: REGION_ID }),
      'REGION_ID_CONFLICT'
    );
    expect(registry.resolve(SECOND_SOURCE_ID)?.isCommitted).toBe(false);
  });

  it('Region 연결을 해제해도 committed Source와 Object URL을 유지한다', () => {
    registry.stage(createRegistration());
    registry.attach({ sourceId: SOURCE_ID, regionId: REGION_ID });

    registry.detach({ sourceId: SOURCE_ID, regionId: REGION_ID });

    expect(registry.resolve(SOURCE_ID)).toMatchObject({
      isCommitted: true,
      objectUrl: 'blob:test-1',
      regionIds: [],
    });
    expect(objectUrlAdapter.revokeObjectUrl).not.toHaveBeenCalled();
  });

  it('한 Source에 여러 Region을 연결하고 detach한 Region ID를 다시 연결할 수 있다', () => {
    const secondRegionId = '44444444-4444-4444-8444-444444444444';
    registry.stage(createRegistration());

    registry.attach({ sourceId: SOURCE_ID, regionId: REGION_ID });
    registry.attach({ sourceId: SOURCE_ID, regionId: secondRegionId });
    registry.detach({ sourceId: SOURCE_ID, regionId: REGION_ID });
    registry.attach({ sourceId: SOURCE_ID, regionId: REGION_ID });

    expect(registry.resolve(SOURCE_ID)?.regionIds).toEqual([secondRegionId, REGION_ID]);
  });

  it('존재하지 않는 Source와 연결 관계를 명확한 오류로 거부한다', () => {
    registry.stage(createRegistration());

    expectRegistryError(() => registry.attach({ sourceId: SECOND_SOURCE_ID, regionId: REGION_ID }), 'SOURCE_NOT_FOUND');
    expectRegistryError(
      () => registry.detach({ sourceId: SOURCE_ID, regionId: REGION_ID }),
      'REGION_ATTACHMENT_NOT_FOUND'
    );
  });

  it('pending Source만 discard하고 반복 정리에서는 URL을 다시 해제하지 않는다', () => {
    registry.stage(createRegistration());

    registry.discardPending(SOURCE_ID);
    registry.discardPending(SOURCE_ID);

    expect(registry.resolve(SOURCE_ID)).toBeNull();
    expect(objectUrlAdapter.revokeObjectUrl).toHaveBeenCalledTimes(1);
    expect(objectUrlAdapter.revokeObjectUrl).toHaveBeenCalledWith('blob:test-1');
  });

  it('pending URL 해제 실패 시 Source를 보존해 다시 정리할 수 있게 한다', () => {
    registry.stage(createRegistration());
    const revokeError = new Error('URL 해제 실패');
    objectUrlAdapter.revokeObjectUrl.mockImplementationOnce(() => {
      throw revokeError;
    });

    const error = expectRegistryError(() => registry.discardPending(SOURCE_ID), 'OBJECT_URL_REVOCATION_FAILED');

    expect(error.cause).toBe(revokeError);
    expect(registry.resolve(SOURCE_ID)).not.toBeNull();

    registry.discardPending(SOURCE_ID);
    expect(registry.resolve(SOURCE_ID)).toBeNull();
    expect(objectUrlAdapter.revokeObjectUrl).toHaveBeenCalledTimes(2);
  });

  it('committed Source를 pending 정리 경로로 제거하지 않는다', () => {
    registry.stage(createRegistration());
    registry.attach({ sourceId: SOURCE_ID, regionId: REGION_ID });

    expectRegistryError(() => registry.discardPending(SOURCE_ID), 'SOURCE_ALREADY_COMMITTED');

    expect(registry.resolve(SOURCE_ID)).not.toBeNull();
    expect(objectUrlAdapter.revokeObjectUrl).not.toHaveBeenCalled();
  });

  it('복원한 Source를 attachment가 없어도 committed 목록에 포함한다', () => {
    registry.restoreCommitted(createRegistration());

    expect(registry.resolve(SOURCE_ID)?.isCommitted).toBe(true);
    expect(registry.listCommittedMetadata()).toEqual([createRegistration().metadata]);
    expectRegistryError(() => registry.discardPending(SOURCE_ID), 'SOURCE_ALREADY_COMMITTED');
  });

  it('committed metadata 목록은 pending을 제외하고 외부 변경과 참조를 공유하지 않는다', () => {
    registry.restoreCommitted(createRegistration());
    registry.stage(createRegistration(SECOND_SOURCE_ID));

    const metadata = registry.listCommittedMetadata();
    (metadata[0] as ProjectAudioSource).fileName = '외부 변경.wav';
    (metadata as ProjectAudioSource[]).push(createRegistration(SECOND_SOURCE_ID).metadata);

    expect(registry.listCommittedMetadata()).toEqual([createRegistration().metadata]);
  });

  it('명시적 purge는 연결이 없는 committed Source만 제거한다', () => {
    registry.stage(createRegistration());
    expectRegistryError(() => registry.purgeUnused(SOURCE_ID), 'SOURCE_NOT_COMMITTED');

    registry.attach({ sourceId: SOURCE_ID, regionId: REGION_ID });
    expectRegistryError(() => registry.purgeUnused(SOURCE_ID), 'SOURCE_STILL_ATTACHED');

    registry.detach({ sourceId: SOURCE_ID, regionId: REGION_ID });
    registry.purgeUnused(SOURCE_ID);

    expect(registry.resolve(SOURCE_ID)).toBeNull();
    expect(objectUrlAdapter.revokeObjectUrl).toHaveBeenCalledWith('blob:test-1');

    registry.clear();
    expect(objectUrlAdapter.revokeObjectUrl).toHaveBeenCalledTimes(1);
  });

  it('clear는 모든 URL 해제를 시도하고 실패한 Source만 다시 정리할 수 있게 보존한다', () => {
    registry.stage(createRegistration());
    registry.restoreCommitted(createRegistration(SECOND_SOURCE_ID));
    const revokeError = new Error('첫 URL 해제 실패');
    objectUrlAdapter.revokeObjectUrl.mockImplementationOnce(() => {
      throw revokeError;
    });

    const error = expectRegistryError(() => registry.clear(), 'OBJECT_URL_REVOCATION_FAILED');

    expect(error.cause).toBe(revokeError);
    expect(objectUrlAdapter.revokeObjectUrl).toHaveBeenCalledTimes(2);
    expect(registry.resolve(SOURCE_ID)).not.toBeNull();
    expect(registry.resolve(SECOND_SOURCE_ID)).toBeNull();

    registry.clear();
    expect(registry.resolve(SOURCE_ID)).toBeNull();
    expect(objectUrlAdapter.revokeObjectUrl).toHaveBeenCalledTimes(3);
  });

  describe('준비된 Source Registry 교체', () => {
    it('새 Source와 연결을 분리해 준비한 뒤 activate에서 한 번에 교체한다', () => {
      registry.restoreCommitted(createRegistration());
      const replacement = registry.beginReplacement();

      replacement.restoreCommitted(createRegistration(SOURCE_ID));
      replacement.attach({ sourceId: SOURCE_ID, regionId: REGION_ID });

      expect(registry.resolve(SOURCE_ID)).toMatchObject({ objectUrl: 'blob:test-1', regionIds: [] });
      expect(replacement.resolve(SOURCE_ID)).toMatchObject({ objectUrl: 'blob:test-2', regionIds: [REGION_ID] });

      replacement.assertActivatable();
      const retiredSources = replacement.activate();

      expect(registry.resolve(SOURCE_ID)).toMatchObject({ objectUrl: 'blob:test-2', regionIds: [REGION_ID] });
      expect(objectUrlAdapter.revokeObjectUrl).not.toHaveBeenCalled();

      retiredSources.dispose();
      expect(objectUrlAdapter.revokeObjectUrl).toHaveBeenCalledWith('blob:test-1');
    });

    it('준비 중 active Registry가 바뀌면 교체를 거부하고 새 변경을 보존한다', () => {
      registry.restoreCommitted(createRegistration());
      const replacement = registry.beginReplacement();
      replacement.restoreCommitted(createRegistration(SECOND_SOURCE_ID));

      registry.stage(createRegistration(THIRD_SOURCE_ID));

      expectRegistryError(() => replacement.assertActivatable(), 'ACTIVE_REGISTRY_CHANGED');
      expect(registry.resolve(SOURCE_ID)).not.toBeNull();
      expect(registry.resolve(THIRD_SOURCE_ID)).not.toBeNull();
      expect(registry.resolve(SECOND_SOURCE_ID)).toBeNull();

      replacement.discard();
      expect(objectUrlAdapter.revokeObjectUrl).toHaveBeenCalledWith('blob:test-2');
    });

    it('discard를 반복해도 준비한 URL만 한 번 해제하고 active Registry는 유지한다', () => {
      registry.restoreCommitted(createRegistration());
      const replacement = registry.beginReplacement();
      replacement.restoreCommitted(createRegistration(SECOND_SOURCE_ID));

      replacement.discard();
      replacement.discard();

      expect(registry.resolve(SOURCE_ID)).not.toBeNull();
      expect(registry.resolve(SECOND_SOURCE_ID)).toBeNull();
      expect(objectUrlAdapter.revokeObjectUrl).toHaveBeenCalledTimes(1);
      expect(objectUrlAdapter.revokeObjectUrl).toHaveBeenCalledWith('blob:test-2');
    });

    it('discard 정리가 일부 실패해도 준비한 Registry를 다시 활성화하지 못한다', () => {
      registry.restoreCommitted(createRegistration());
      const replacement = registry.beginReplacement();
      replacement.restoreCommitted(createRegistration(SECOND_SOURCE_ID));
      objectUrlAdapter.revokeObjectUrl.mockImplementationOnce(() => {
        throw new Error('준비 URL 해제 실패');
      });
      const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const firstCleanup = replacement.discard();
      const retriedCleanup = replacement.discard();

      expect(firstCleanup).toEqual({ isComplete: false, failedResourceCount: 1 });
      expect(retriedCleanup).toEqual({ isComplete: true, failedResourceCount: 0 });
      expectRegistryError(() => replacement.assertActivatable(), 'ACTIVE_REGISTRY_CHANGED');
      expectRegistryError(() => replacement.activate(), 'ACTIVE_REGISTRY_CHANGED');
      expect(registry.resolve(SOURCE_ID)).not.toBeNull();
      expect(registry.resolve(SECOND_SOURCE_ID)).toBeNull();
      expect(logError).toHaveBeenCalledTimes(1);
    });

    it('빈 Registry를 활성화해도 이전 URL은 retired dispose 전까지 유지한다', () => {
      registry.restoreCommitted(createRegistration());
      const replacement = registry.beginReplacement();

      const retiredSources = replacement.activate();

      expect(registry.resolve(SOURCE_ID)).toBeNull();
      expect(objectUrlAdapter.revokeObjectUrl).not.toHaveBeenCalled();

      retiredSources.dispose();
      expect(objectUrlAdapter.revokeObjectUrl).toHaveBeenCalledWith('blob:test-1');
    });

    it('activate 뒤 이전 URL 정리가 실패해도 새 Registry를 되돌리지 않는다', () => {
      registry.restoreCommitted(createRegistration());
      const replacement = registry.beginReplacement();
      replacement.restoreCommitted(createRegistration(SECOND_SOURCE_ID));
      replacement.assertActivatable();
      const retiredSources = replacement.activate();
      objectUrlAdapter.revokeObjectUrl.mockImplementationOnce(() => {
        throw new Error('이전 URL 해제 실패');
      });
      const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const firstCleanup = retiredSources.dispose();
      const retriedCleanup = retiredSources.dispose();

      expect(firstCleanup).toEqual({ isComplete: false, failedResourceCount: 1 });
      expect(retriedCleanup).toEqual({ isComplete: true, failedResourceCount: 0 });
      expect(registry.resolve(SOURCE_ID)).toBeNull();
      expect(registry.resolve(SECOND_SOURCE_ID)).not.toBeNull();
      expect(logError).toHaveBeenCalledTimes(1);
    });
  });
});

describe('BrowserObjectUrlAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('브라우저 URL API에 생성과 해제를 위임한다', () => {
    const blob = new Blob(['test']);
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:browser-source');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const adapter = new BrowserObjectUrlAdapter();

    expect(adapter.createObjectUrl(blob)).toBe('blob:browser-source');
    adapter.revokeObjectUrl('blob:browser-source');

    expect(createObjectUrl).toHaveBeenCalledWith(blob);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:browser-source');
  });
});
