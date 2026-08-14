import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { IAudioSourceRegistry } from '../audio-source-registry/i-audio-source-registry';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import type { RegionState, SessionStore } from '../session/session';
import type {
  EditorRegionSelection,
  EditorRegionSnapshot,
  EditorTrackRegionSnapshot,
  IEditorRegionRuntime,
} from '../shared/types/editor-runtime';
import type { EditorController } from './editor-controller';
import {
  ProjectMutationCompensationError,
  type ProjectMutationCompensationFailure,
} from './project-mutation-compensation-error';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

interface RegionProcessingControllerDependencies {
  readonly audioEngine: IAudioEngine;
  readonly audioSourceRegistry: IAudioSourceRegistry;
  readonly audioSourceRepository: IAudioSourceRepository;
  readonly createSourceId?: () => string;
  readonly editorController: EditorController;
  readonly regionRuntime: IEditorRegionRuntime;
  readonly sessionStore: SessionStore;
}

interface StripSilenceRequest {
  readonly minimumSilenceSeconds: number;
  readonly thresholdDb: number;
}

interface TimeStretchRequest {
  readonly stretchRatio: number;
}

interface PitchShiftRequest {
  readonly semitones: number;
}

interface TransientAnalysisRequest {
  readonly sensitivity: number;
}

type DerivedSourceRequest =
  | (StripSilenceRequest & { readonly operation: 'stripSilence' })
  | (TimeStretchRequest & { readonly operation: 'timeStretch' })
  | (PitchShiftRequest & { readonly operation: 'pitchShift' })
  | (TransientAnalysisRequest & { readonly operation: 'transientAnalysis' })
  | { readonly operation: 'bounce' | 'freeze' | 'reverse' };

interface DerivedSourceReplacement {
  readonly durationSeconds: number;
  readonly regionId: string;
  readonly sourceId: string;
  readonly trackId: string;
}

export class RegionProcessingController {
  readonly #audioEngine: IAudioEngine;
  readonly #audioSourceRegistry: IAudioSourceRegistry;
  readonly #audioSourceRepository: IAudioSourceRepository;
  readonly #createSourceId: () => string;
  readonly #editorController: EditorController;
  readonly #regionRuntime: IEditorRegionRuntime;
  readonly #sessionStore: SessionStore;

  constructor({
    audioEngine,
    audioSourceRegistry,
    audioSourceRepository,
    createSourceId = () => globalThis.crypto.randomUUID(),
    editorController,
    regionRuntime,
    sessionStore,
  }: RegionProcessingControllerDependencies) {
    this.#audioEngine = audioEngine;
    this.#audioSourceRegistry = audioSourceRegistry;
    this.#audioSourceRepository = audioSourceRepository;
    this.#createSourceId = createSourceId;
    this.#editorController = editorController;
    this.#regionRuntime = regionRuntime;
    this.#sessionStore = sessionStore;
  }

  async normalizeSelectedRegions(targetPeak: number): Promise<void> {
    const selections = this.getSelectedRegions();
    const gains = new Map<string, number>();
    await Promise.all(
      selections.map(async selection => {
        const region = this.getRegion(selection);
        const registration = this.getSourceRegistration(region.sourceId);
        const peak = await this.#audioEngine.analyzeAudioRegionPeak({
          blob: registration.blob,
          durationSeconds: region.duration,
          sourceStartTimeSeconds: region.sourceStartTime,
        });
        if (!Number.isFinite(peak) || peak <= 0) {
          throw new ProjectStateError(
            ProjectStateErrorCode.INVALID_EDITOR_SELECTION,
            `무음 Region은 Normalize할 수 없습니다: ${region.id}`,
            { regionId: region.id }
          );
        }
        gains.set(this.createSelectionKey(selection), region.gain * (targetPeak / peak));
      })
    );

    await this.#regionRuntime.replaceTrackRegions({
      tracks: this.createSelectedTrackSnapshots(selections, (region, trackId) => ({
        ...region,
        gain: gains.get(this.createSelectionKey({ regionId: region.id, trackId })) ?? region.gain,
      })),
    });
  }

  reverseSelectedRegions(): Promise<void> {
    return this.createDerivedSourcesForSelection({ operation: 'reverse' });
  }

  stripSilenceFromSelectedRegions(request: StripSilenceRequest): Promise<void> {
    return this.createDerivedSourcesForSelection({ operation: 'stripSilence', ...request });
  }

  timeStretchSelectedRegions(request: TimeStretchRequest): Promise<void> {
    return this.createDerivedSourcesForSelection({ operation: 'timeStretch', ...request });
  }

  pitchShiftSelectedRegions(request: PitchShiftRequest): Promise<void> {
    return this.createDerivedSourcesForSelection({ operation: 'pitchShift', ...request });
  }

  analyzeTransientsInSelectedRegions(request: TransientAnalysisRequest): Promise<void> {
    return this.createDerivedSourcesForSelection({ operation: 'transientAnalysis', ...request });
  }

  bounceSelectedRegions(): Promise<void> {
    return this.createDerivedSourcesForSelection({ operation: 'bounce' });
  }

  freezeSelectedRegions(): Promise<void> {
    return this.createDerivedSourcesForSelection({ operation: 'freeze' });
  }

  private async createDerivedSourcesForSelection(request: DerivedSourceRequest): Promise<void> {
    const selections = this.getSelectedRegions();
    const replacements: DerivedSourceReplacement[] = [];
    const createdSourceIds: string[] = [];

    try {
      for (const selection of selections) {
        const region = this.getRegion(selection);
        const registration = this.getSourceRegistration(region.sourceId);
        const rendered = await this.#audioEngine.renderDerivedAudioRegion({
          blob: registration.blob,
          durationSeconds: region.duration,
          minimumSilenceSeconds: 'minimumSilenceSeconds' in request ? request.minimumSilenceSeconds : undefined,
          operation: request.operation,
          pitchSemitones: 'semitones' in request ? request.semitones : undefined,
          sourceStartTimeSeconds: region.sourceStartTime,
          stretchRatio: 'stretchRatio' in request ? request.stretchRatio : undefined,
          thresholdDb: 'thresholdDb' in request ? request.thresholdDb : undefined,
          transientSensitivity: 'sensitivity' in request ? request.sensitivity : undefined,
        });
        const sourceId = this.#createSourceId();
        const derivedRegistration = {
          blob: rendered.blob,
          metadata: {
            byteLength: rendered.blob.size,
            durationSeconds: rendered.durationSeconds,
            fileName: `${request.operation}-${sourceId}.wav`,
            id: sourceId,
            mimeType: rendered.blob.type || 'audio/wav',
            bwfMetadata: null,
            derivation: {
              operation: request.operation,
              parameters: this.createDerivationParameters(request),
              sourceId: region.sourceId,
            },
            tags: [],
            transientPositionsSeconds: [...(rendered.transientPositionsSeconds ?? [])],
          },
        };
        await this.#audioSourceRepository.create(derivedRegistration);
        createdSourceIds.push(sourceId);
        this.#audioSourceRegistry.restoreCommitted(derivedRegistration);
        replacements.push({
          durationSeconds: rendered.durationSeconds,
          regionId: region.id,
          sourceId,
          trackId: selection.trackId,
        });
      }

      const replacementByRegion = new Map(
        replacements.map(replacement => [this.createSelectionKey(replacement), replacement] as const)
      );
      await this.#regionRuntime.replaceTrackRegions({
        tracks: this.createSelectedTrackSnapshots(selections, (region, trackId) => {
          const replacement = replacementByRegion.get(this.createSelectionKey({ regionId: region.id, trackId }));
          if (!replacement) {
            return region;
          }
          return {
            ...region,
            durationSeconds: replacement.durationSeconds,
            fadeIn: {
              ...region.fadeIn,
              crossfadeId: null,
              durationSeconds: Math.min(region.fadeIn.durationSeconds, replacement.durationSeconds),
            },
            fadeOut: {
              ...region.fadeOut,
              crossfadeId: null,
              durationSeconds: Math.min(region.fadeOut.durationSeconds, replacement.durationSeconds),
            },
            sourceId: replacement.sourceId,
            sourceStartTimeSeconds: 0,
          };
        }),
      });
    } catch (cause) {
      await this.rollbackDerivedSources({ cause, sourceIds: createdSourceIds });
      throw cause;
    }
  }

  private createDerivationParameters(request: DerivedSourceRequest): Record<string, number> {
    switch (request.operation) {
      case 'stripSilence':
        return {
          minimumSilenceSeconds: request.minimumSilenceSeconds,
          thresholdDb: request.thresholdDb,
        };
      case 'timeStretch':
        return { stretchRatio: request.stretchRatio };
      case 'pitchShift':
        return { semitones: request.semitones };
      case 'transientAnalysis':
        return { sensitivity: request.sensitivity };
      case 'bounce':
      case 'freeze':
      case 'reverse':
        return {};
    }
  }

  private getSelectedRegions(): readonly EditorRegionSelection[] {
    const selections = this.#editorController.getState().selection.regions;
    if (selections.length === 0) {
      throw new ProjectStateError(ProjectStateErrorCode.EDITOR_SELECTION_EMPTY, '처리할 Region 선택이 없습니다.');
    }
    return selections;
  }

  private getRegion(selection: EditorRegionSelection): RegionState {
    const region = this.#sessionStore
      .getState()
      .tracks.get(selection.trackId)
      ?.regions.find(candidate => candidate.id === selection.regionId);
    if (!region) {
      throw new ProjectStateError(
        ProjectStateErrorCode.REGION_NOT_FOUND,
        `Region을 찾을 수 없습니다: ${selection.regionId}`
      );
    }
    return region;
  }

  private getSourceRegistration(sourceId: string) {
    const registration = this.#audioSourceRegistry
      .listCommittedRegistrations()
      .find(candidate => candidate.metadata.id === sourceId);
    if (!registration) {
      throw new ProjectStateError(
        ProjectStateErrorCode.REGION_SOURCE_MISSING,
        `Region Source를 찾을 수 없습니다: ${sourceId}`
      );
    }
    return registration;
  }

  private createSelectedTrackSnapshots(
    selections: readonly EditorRegionSelection[],
    replace: (region: EditorRegionSnapshot, trackId: string) => EditorRegionSnapshot
  ): EditorTrackRegionSnapshot[] {
    return [...new Set(selections.map(selection => selection.trackId))].map(trackId => {
      const track = this.#sessionStore.getState().tracks.get(trackId);
      if (!track) {
        throw new ProjectStateError(ProjectStateErrorCode.TRACK_NOT_FOUND, `Track을 찾을 수 없습니다: ${trackId}`);
      }
      return {
        regions: track.regions.map(region => replace(this.toRegionSnapshot(region), trackId)),
        trackId,
      };
    });
  }

  private toRegionSnapshot(region: RegionState): EditorRegionSnapshot {
    return {
      durationSeconds: region.duration,
      fadeIn: { ...region.fadeIn },
      fadeOut: { ...region.fadeOut },
      gain: region.gain,
      id: region.id,
      isOpaque: region.isOpaque,
      layer: region.layer,
      sourceId: region.sourceId,
      sourceStartTimeSeconds: region.sourceStartTime,
      startTimeSeconds: region.startTime,
    };
  }

  private createSelectionKey(selection: { readonly regionId: string; readonly trackId: string }): string {
    return `${selection.trackId}\u0000${selection.regionId}`;
  }

  private async rollbackDerivedSources({
    cause,
    sourceIds,
  }: {
    readonly cause: unknown;
    readonly sourceIds: readonly string[];
  }): Promise<void> {
    const compensationFailures: ProjectMutationCompensationFailure[] = [];
    for (const sourceId of [...sourceIds].reverse()) {
      if (this.#audioSourceRegistry.resolve(sourceId)) {
        try {
          this.#audioSourceRegistry.purgeUnused(sourceId);
        } catch (compensationCause) {
          compensationFailures.push({ cause: compensationCause, step: `파생 Source runtime 정리: ${sourceId}` });
        }
      }
      try {
        await this.#audioSourceRepository.delete(sourceId);
      } catch (compensationCause) {
        compensationFailures.push({ cause: compensationCause, step: `파생 Source 저장 파일 정리: ${sourceId}` });
      }
    }
    if (compensationFailures.length > 0) {
      throw new ProjectMutationCompensationError({
        operation: 'process-region-source',
        failedPhase: '파생 Source와 Region 연결',
        cause,
        compensationFailures,
      });
    }
  }
}
