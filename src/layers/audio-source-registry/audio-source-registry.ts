import { z } from 'zod';
import { COMPLETE_RESOURCE_CLEANUP, type ResourceCleanupResult } from '../shared/types/resource-cleanup';
import { ProjectAudioSourceSchema, type ProjectAudioSource } from '../shared/types/project-document.schema';
import { AudioSourceRegistryError } from './errors';
import type {
  AudioSourceAttachment,
  AudioSourceLoopSlotAttachment,
  AudioSourceRegistration,
  IAudioSourceRegistry,
  IPreparedAudioSourceRegistryReplacement,
  IRetiredAudioSourceRegistry,
  RuntimeAudioSource,
} from './i-audio-source-registry';
import type { IObjectUrlAdapter } from './i-object-url-adapter';

const RegionIdSchema = z.uuid('Invalid Region ID format');
const LoopSlotIdSchema = z.uuid('Invalid Loop Slot ID format');

interface StoredAudioSource {
  readonly metadata: ProjectAudioSource;
  readonly blob: Blob;
  readonly objectUrl: string;
  isCommitted: boolean;
  readonly regionIds: Set<string>;
  readonly loopSlotIds: Set<string>;
}

interface RetiredAudioSourceRegistryState {
  readonly sources: Map<string, StoredAudioSource>;
  readonly sourceIdByRegionId: Map<string, string>;
  readonly sourceIdByLoopSlotId: Map<string, string>;
}

type PreparedRegistryState = 'activated' | 'discarded' | 'prepared';

export class AudioSourceRegistry implements IAudioSourceRegistry {
  private sources = new Map<string, StoredAudioSource>();
  private sourceIdByRegionId = new Map<string, string>();
  private sourceIdByLoopSlotId = new Map<string, string>();
  private mutationRevision = 0;
  private readonly pendingDetachedRegistryCleanup = new Set<AudioSourceRegistry>();
  private readonly pendingRetiredRegistryCleanup = new Set<RetiredAudioSourceRegistryState>();

  constructor(private readonly objectUrlAdapter: IObjectUrlAdapter) {}

  stage(registration: AudioSourceRegistration): RuntimeAudioSource {
    const source = this.register(registration, false);
    this.mutationRevision += 1;
    return source;
  }

  restoreCommitted(registration: AudioSourceRegistration): RuntimeAudioSource {
    const source = this.register(registration, true);
    this.mutationRevision += 1;
    return source;
  }

  beginReplacement(): IPreparedAudioSourceRegistryReplacement {
    this.retryPendingCleanup();
    const expectedRevision = this.mutationRevision;
    const replacementRegistry = new AudioSourceRegistry(this.objectUrlAdapter);
    let retiredSources: IRetiredAudioSourceRegistry | undefined;
    let state: PreparedRegistryState = 'prepared';

    const assertPrepared = (): void => {
      if (state !== 'prepared') {
        throw new AudioSourceRegistryError({
          code: 'ACTIVE_REGISTRY_CHANGED',
          message: '이미 종료한 Source Registry 교체는 변경할 수 없습니다.',
        });
      }
    };

    const assertActivatable = (): void => {
      if (state === 'activated') {
        return;
      }
      assertPrepared();
      if (this.mutationRevision === expectedRevision) {
        return;
      }

      throw new AudioSourceRegistryError({
        code: 'ACTIVE_REGISTRY_CHANGED',
        message: '프로젝트를 준비하는 동안 active Source Registry가 변경되었습니다.',
        details: { actualRevision: this.mutationRevision, expectedRevision },
      });
    };

    return {
      restoreCommitted: registration => {
        assertPrepared();
        return replacementRegistry.restoreCommitted(registration);
      },
      attach: attachment => {
        assertPrepared();
        replacementRegistry.attach(attachment);
      },
      attachLoopSlot: attachment => {
        assertPrepared();
        replacementRegistry.attachLoopSlot(attachment);
      },
      resolve: sourceId => replacementRegistry.resolve(sourceId),
      listCommittedMetadata: () => replacementRegistry.listCommittedMetadata(),
      assertActivatable,
      activate: () => {
        if (retiredSources) {
          return retiredSources;
        }

        assertActivatable();
        const previousSources = this.sources;
        const previousSourceIdByRegionId = this.sourceIdByRegionId;
        const previousSourceIdByLoopSlotId = this.sourceIdByLoopSlotId;
        this.sources = replacementRegistry.sources;
        this.sourceIdByRegionId = replacementRegistry.sourceIdByRegionId;
        this.sourceIdByLoopSlotId = replacementRegistry.sourceIdByLoopSlotId;
        replacementRegistry.sources = new Map();
        replacementRegistry.sourceIdByRegionId = new Map();
        replacementRegistry.sourceIdByLoopSlotId = new Map();
        this.mutationRevision += 1;
        state = 'activated';
        retiredSources = this.createRetiredSources(
          previousSources,
          previousSourceIdByRegionId,
          previousSourceIdByLoopSlotId
        );
        return retiredSources;
      },
      discard: () => {
        if (state === 'activated') {
          return COMPLETE_RESOURCE_CLEANUP;
        }

        state = 'discarded';
        return this.disposeDetachedRegistry(replacementRegistry);
      },
    };
  }

  resolve(sourceId: string): RuntimeAudioSource | null {
    const source = this.sources.get(sourceId);
    return source ? this.createRuntimeSource(source) : null;
  }

  listCommittedMetadata(): ReadonlyArray<Readonly<ProjectAudioSource>> {
    return [...this.sources.values()].filter(source => source.isCommitted).map(source => ({ ...source.metadata }));
  }

  listCommittedRegistrations(): ReadonlyArray<Readonly<AudioSourceRegistration>> {
    return [...this.sources.values()]
      .filter(source => source.isCommitted)
      .map(source => ({ metadata: { ...source.metadata }, blob: source.blob }));
  }

  attach({ sourceId, regionId }: AudioSourceAttachment): void {
    this.assertValidRegionId(regionId);
    const source = this.getRequiredSource(sourceId);
    const attachedSourceId = this.sourceIdByRegionId.get(regionId);

    if (attachedSourceId) {
      throw new AudioSourceRegistryError({
        code: 'REGION_ID_CONFLICT',
        message: `Region ID가 이미 다른 Source 연결에 사용 중입니다: ${regionId}`,
        details: { attachedSourceId, regionId, requestedSourceId: sourceId },
      });
    }

    source.regionIds.add(regionId);
    source.isCommitted = true;
    this.sourceIdByRegionId.set(regionId, sourceId);
    this.mutationRevision += 1;
  }

  detach({ sourceId, regionId }: AudioSourceAttachment): void {
    this.assertValidRegionId(regionId);
    const source = this.getRequiredSource(sourceId);

    if (this.sourceIdByRegionId.get(regionId) !== sourceId) {
      throw new AudioSourceRegistryError({
        code: 'REGION_ATTACHMENT_NOT_FOUND',
        message: `Source와 Region의 연결을 찾을 수 없습니다: ${sourceId} / ${regionId}`,
        details: { sourceId, regionId },
      });
    }

    source.regionIds.delete(regionId);
    this.sourceIdByRegionId.delete(regionId);
    this.mutationRevision += 1;
  }

  attachLoopSlot({ sourceId, loopSlotId }: AudioSourceLoopSlotAttachment): void {
    this.assertValidLoopSlotId(loopSlotId);
    const source = this.getRequiredSource(sourceId);
    const attachedSourceId = this.sourceIdByLoopSlotId.get(loopSlotId);
    if (attachedSourceId) {
      throw new AudioSourceRegistryError({
        code: 'LOOP_SLOT_ID_CONFLICT',
        message: `루프 슬롯 ID가 이미 다른 Source 연결에 사용 중입니다: ${loopSlotId}`,
        details: { attachedSourceId, loopSlotId, requestedSourceId: sourceId },
      });
    }

    source.loopSlotIds.add(loopSlotId);
    source.isCommitted = true;
    this.sourceIdByLoopSlotId.set(loopSlotId, sourceId);
    this.mutationRevision += 1;
  }

  detachLoopSlot({ sourceId, loopSlotId }: AudioSourceLoopSlotAttachment): void {
    this.assertValidLoopSlotId(loopSlotId);
    const source = this.getRequiredSource(sourceId);
    if (this.sourceIdByLoopSlotId.get(loopSlotId) !== sourceId) {
      throw new AudioSourceRegistryError({
        code: 'LOOP_SLOT_ATTACHMENT_NOT_FOUND',
        message: `Source와 루프 슬롯의 연결을 찾을 수 없습니다: ${sourceId} / ${loopSlotId}`,
        details: { loopSlotId, sourceId },
      });
    }

    source.loopSlotIds.delete(loopSlotId);
    this.sourceIdByLoopSlotId.delete(loopSlotId);
    this.mutationRevision += 1;
  }

  discardPending(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (!source) {
      return;
    }

    if (source.isCommitted) {
      throw new AudioSourceRegistryError({
        code: 'SOURCE_ALREADY_COMMITTED',
        message: `연결된 적이 있는 Source는 pending 정리로 제거할 수 없습니다: ${sourceId}`,
        details: { sourceId },
      });
    }

    this.removeSourceAndRevoke(sourceId, source);
    this.mutationRevision += 1;
  }

  purgeUnused(sourceId: string): void {
    const source = this.getRequiredSource(sourceId);

    if (!source.isCommitted) {
      throw new AudioSourceRegistryError({
        code: 'SOURCE_NOT_COMMITTED',
        message: `pending Source는 명시적 미사용 정리 대상으로 처리할 수 없습니다: ${sourceId}`,
        details: { sourceId },
      });
    }

    if (source.regionIds.size > 0 || source.loopSlotIds.size > 0) {
      throw new AudioSourceRegistryError({
        code: 'SOURCE_STILL_ATTACHED',
        message: `Region이 연결된 Source는 제거할 수 없습니다: ${sourceId}`,
        details: { loopSlotIds: [...source.loopSlotIds], regionIds: [...source.regionIds], sourceId },
      });
    }

    this.removeSourceAndRevoke(sourceId, source);
    this.mutationRevision += 1;
  }

  clear(): void {
    this.retryPendingCleanup();
    const sources = [...this.sources.entries()];
    let firstRevocationError: unknown;
    const failedSourceIds: string[] = [];
    let removedSourceCount = 0;
    sources.forEach(([sourceId, source]) => {
      try {
        this.objectUrlAdapter.revokeObjectUrl(source.objectUrl);
      } catch (error) {
        firstRevocationError ??= error;
        failedSourceIds.push(sourceId);
        return;
      }

      this.sources.delete(sourceId);
      source.regionIds.forEach(regionId => this.sourceIdByRegionId.delete(regionId));
      source.loopSlotIds.forEach(loopSlotId => this.sourceIdByLoopSlotId.delete(loopSlotId));
      removedSourceCount += 1;
    });

    if (removedSourceCount > 0) {
      this.mutationRevision += 1;
    }

    if (firstRevocationError) {
      throw new AudioSourceRegistryError({
        code: 'OBJECT_URL_REVOCATION_FAILED',
        message: '일부 오디오 Source의 Object URL을 해제하지 못했습니다.',
        details: { failedSourceIds, sourceCount: sources.length },
        cause: firstRevocationError,
      });
    }
  }

  private register(registration: AudioSourceRegistration, isCommitted: boolean): RuntimeAudioSource {
    const metadata = this.parseMetadata(registration.metadata);
    this.assertValidBlob(registration.blob);

    if (this.sources.has(metadata.id)) {
      throw new AudioSourceRegistryError({
        code: 'SOURCE_ID_CONFLICT',
        message: `이미 등록된 Source ID입니다: ${metadata.id}`,
        details: { sourceId: metadata.id },
      });
    }

    if (metadata.byteLength !== registration.blob.size) {
      throw new AudioSourceRegistryError({
        code: 'SOURCE_BYTE_LENGTH_MISMATCH',
        message: `Source metadata와 Blob의 byteLength가 다릅니다: ${metadata.id}`,
        details: {
          blobByteLength: registration.blob.size,
          metadataByteLength: metadata.byteLength,
          sourceId: metadata.id,
        },
      });
    }

    const objectUrl = this.createObjectUrl(registration.blob, metadata.id);
    const source: StoredAudioSource = {
      metadata: { ...metadata },
      blob: registration.blob,
      objectUrl,
      isCommitted,
      regionIds: new Set(),
      loopSlotIds: new Set(),
    };
    this.sources.set(metadata.id, source);

    return this.createRuntimeSource(source);
  }

  private parseMetadata(metadata: ProjectAudioSource): ProjectAudioSource {
    const result = ProjectAudioSourceSchema.safeParse(metadata);
    if (!result.success) {
      throw new AudioSourceRegistryError({
        code: 'INVALID_SOURCE_METADATA',
        message: '오디오 Source metadata가 유효하지 않습니다.',
        details: { issues: result.error.issues },
      });
    }

    return result.data;
  }

  private assertValidBlob(blob: unknown): asserts blob is Blob {
    if (typeof globalThis.Blob === 'function' && blob instanceof globalThis.Blob) {
      return;
    }

    throw new AudioSourceRegistryError({
      code: 'INVALID_SOURCE_BLOB',
      message: '오디오 Source의 원본이 Blob 형식이 아닙니다.',
    });
  }

  private createObjectUrl(blob: Blob, sourceId: string): string {
    let objectUrl: string;

    try {
      objectUrl = this.objectUrlAdapter.createObjectUrl(blob);
    } catch (cause) {
      throw new AudioSourceRegistryError({
        code: 'OBJECT_URL_CREATION_FAILED',
        message: `오디오 Source의 Object URL을 만들지 못했습니다: ${sourceId}`,
        details: { sourceId },
        cause,
      });
    }

    if (typeof objectUrl !== 'string' || objectUrl.trim().length === 0) {
      throw new AudioSourceRegistryError({
        code: 'OBJECT_URL_CREATION_FAILED',
        message: `오디오 Source의 Object URL이 비어 있습니다: ${sourceId}`,
        details: { sourceId },
      });
    }

    return objectUrl;
  }

  private createRuntimeSource(source: StoredAudioSource): RuntimeAudioSource {
    return {
      metadata: { ...source.metadata },
      objectUrl: source.objectUrl,
      isCommitted: source.isCommitted,
      regionIds: [...source.regionIds],
      loopSlotIds: [...source.loopSlotIds],
    };
  }

  private getRequiredSource(sourceId: string): StoredAudioSource {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new AudioSourceRegistryError({
        code: 'SOURCE_NOT_FOUND',
        message: `등록된 오디오 Source를 찾을 수 없습니다: ${sourceId}`,
        details: { sourceId },
      });
    }

    return source;
  }

  private assertValidRegionId(regionId: string): void {
    if (RegionIdSchema.safeParse(regionId).success) {
      return;
    }

    throw new AudioSourceRegistryError({
      code: 'INVALID_REGION_ID',
      message: `Region ID 형식이 유효하지 않습니다: ${regionId}`,
      details: { regionId },
    });
  }

  private assertValidLoopSlotId(loopSlotId: string): void {
    if (LoopSlotIdSchema.safeParse(loopSlotId).success) {
      return;
    }

    throw new AudioSourceRegistryError({
      code: 'INVALID_LOOP_SLOT_ID',
      message: `루프 슬롯 ID 형식이 유효하지 않습니다: ${loopSlotId}`,
      details: { loopSlotId },
    });
  }

  private removeSourceAndRevoke(sourceId: string, source: StoredAudioSource): void {
    try {
      this.objectUrlAdapter.revokeObjectUrl(source.objectUrl);
    } catch (cause) {
      throw new AudioSourceRegistryError({
        code: 'OBJECT_URL_REVOCATION_FAILED',
        message: `오디오 Source의 Object URL을 해제하지 못했습니다: ${sourceId}`,
        details: { objectUrl: source.objectUrl, sourceId },
        cause,
      });
    }

    this.sources.delete(sourceId);
  }

  private createRetiredSources(
    sources: Map<string, StoredAudioSource>,
    sourceIdByRegionId: Map<string, string>,
    sourceIdByLoopSlotId: Map<string, string>
  ): IRetiredAudioSourceRegistry {
    const retiredState = { sources, sourceIdByLoopSlotId, sourceIdByRegionId };
    this.pendingRetiredRegistryCleanup.add(retiredState);

    return {
      dispose: () => this.disposeRetiredRegistry(retiredState),
    };
  }

  private disposeDetachedRegistry(registry: AudioSourceRegistry): ResourceCleanupResult {
    let cleanupError: unknown;

    try {
      registry.clear();
    } catch (error) {
      cleanupError = error;
    }

    const failedResourceCount = registry.sources.size;
    if (failedResourceCount === 0) {
      this.pendingDetachedRegistryCleanup.delete(registry);
      return COMPLETE_RESOURCE_CLEANUP;
    }

    this.pendingDetachedRegistryCleanup.add(registry);
    console.error('[AudioSourceRegistry] 준비한 Source Registry 정리에 실패했습니다.', cleanupError);
    return { isComplete: false, failedResourceCount };
  }

  private disposeRetiredRegistry(retiredState: RetiredAudioSourceRegistryState): ResourceCleanupResult {
    const failedSourceIds: string[] = [];
    let firstRevocationError: unknown;
    retiredState.sources.forEach((source, sourceId) => {
      try {
        this.objectUrlAdapter.revokeObjectUrl(source.objectUrl);
      } catch (error) {
        firstRevocationError ??= error;
        failedSourceIds.push(sourceId);
        return;
      }

      retiredState.sources.delete(sourceId);
    });

    if (failedSourceIds.length > 0) {
      console.error(
        '[AudioSourceRegistry] 이전 프로젝트 Object URL 정리에 실패했습니다.',
        new AudioSourceRegistryError({
          code: 'OBJECT_URL_REVOCATION_FAILED',
          message: '이전 프로젝트의 일부 Object URL을 해제하지 못했습니다.',
          details: { failedSourceIds },
          cause: firstRevocationError,
        })
      );
      return { isComplete: false, failedResourceCount: failedSourceIds.length };
    }

    retiredState.sourceIdByRegionId.clear();
    retiredState.sourceIdByLoopSlotId.clear();
    this.pendingRetiredRegistryCleanup.delete(retiredState);
    return COMPLETE_RESOURCE_CLEANUP;
  }

  private retryPendingCleanup(): void {
    [...this.pendingDetachedRegistryCleanup].forEach(registry => this.disposeDetachedRegistry(registry));
    [...this.pendingRetiredRegistryCleanup].forEach(retiredState => this.disposeRetiredRegistry(retiredState));
  }
}
