import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { IAudioSourceRegistry } from '../audio-source-registry/i-audio-source-registry';
import { createDefaultLoopSlots, type SessionStore, type TrackState } from '../session/session';
import { ProjectMutationCompensationError } from './project-mutation-compensation-error';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

interface TrackControllerDependencies {
  sessionStore: SessionStore;
  audioEngine: IAudioEngine;
  audioSourceRegistry: IAudioSourceRegistry;
}

type TrackSourceAttachment =
  | {
      kind: 'region';
      sourceId: string;
      regionId: string;
    }
  | {
      kind: 'loop-slot';
      sourceId: string;
      loopSlotId: string;
    };

export class TrackController {
  private readonly sessionStore: SessionStore;
  private readonly audioEngine: IAudioEngine;
  private readonly audioSourceRegistry: IAudioSourceRegistry;

  constructor({ sessionStore, audioEngine, audioSourceRegistry }: TrackControllerDependencies) {
    this.sessionStore = sessionStore;
    this.audioEngine = audioEngine;
    this.audioSourceRegistry = audioSourceRegistry;
  }

  async addTrack(id: string): Promise<void> {
    console.log(`[TrackController] Adding track: ${id}`);

    this.throwIfTrackExists(id);
    await this.audioEngine.addTrack(id);
    this.throwIfTrackExists(id);

    this.sessionStore.getState().addTrack({
      id,
      name: `Track ${id}`,
      volume: 1.0,
      pan: 0,
      isMuted: false,
      isSoloed: false,
      status: [],
      pluginInstances: [],
      regions: [],
      loopSlots: createDefaultLoopSlots(),
    });
  }

  removeTrack(id: string): void {
    console.log(`[TrackController] Removing track: ${id}`);

    const track = this.getTrackOrThrow(id);
    const sourceAttachments = this.getSourceAttachments(track);
    this.validateSourceAttachments(sourceAttachments);
    const detachedAttachments = this.detachSourceAttachments(sourceAttachments);

    try {
      this.audioEngine.removeTrack(id);
    } catch (cause) {
      this.restoreSourceAttachments({
        attachments: [...detachedAttachments].reverse(),
        cause,
        failedPhase: 'AudioEngine 제거',
      });
      throw cause;
    }

    this.sessionStore.getState().removeTrack(id);
  }

  setVolume(trackId: string, volume: number): void {
    console.log(`[TrackController] Setting volume for ${trackId}: ${volume}`);

    this.getTrackOrThrow(trackId);
    this.audioEngine.setTrackVolume(trackId, volume);
    this.sessionStore.getState().updateTrack(trackId, { volume });
  }

  setName(trackId: string, name: string): void {
    this.getTrackOrThrow(trackId);
    this.sessionStore.getState().updateTrack(trackId, { name });
  }

  setPan(trackId: string, pan: number): void {
    console.log(`[TrackController] Setting pan for ${trackId}: ${pan}`);

    this.getTrackOrThrow(trackId);
    this.audioEngine.setTrackPan(trackId, pan);
    this.sessionStore.getState().updateTrack(trackId, { pan });
  }

  setMute(trackId: string, muted: boolean): void {
    console.log(`[TrackController] Setting mute for ${trackId}: ${muted}`);

    this.getTrackOrThrow(trackId);
    this.audioEngine.setTrackMute(trackId, muted);
    this.sessionStore.getState().updateTrack(trackId, { isMuted: muted });
  }

  setSolo(trackId: string, soloed: boolean): void {
    console.log(`[TrackController] Setting solo for ${trackId}: ${soloed}`);

    this.getTrackOrThrow(trackId);
    this.audioEngine.setTrackSolo(trackId, soloed);
    this.sessionStore.getState().updateTrack(trackId, { isSoloed: soloed });
  }

  private getTrackOrThrow(trackId: string): TrackState {
    const track = this.sessionStore.getState().tracks.get(trackId);
    if (track) {
      return track;
    }

    throw new ProjectStateError(ProjectStateErrorCode.TRACK_NOT_FOUND, `트랙을 찾을 수 없습니다: ${trackId}`, {
      trackId,
    });
  }

  private throwIfTrackExists(trackId: string): void {
    if (!this.sessionStore.getState().tracks.has(trackId)) {
      return;
    }

    throw new ProjectStateError(ProjectStateErrorCode.TRACK_ID_CONFLICT, `이미 사용 중인 Track ID입니다: ${trackId}`, {
      trackId,
    });
  }

  private getSourceAttachments(track: TrackState): TrackSourceAttachment[] {
    const regionAttachments: TrackSourceAttachment[] = track.regions.map(region => ({
      kind: 'region',
      sourceId: region.sourceId,
      regionId: region.id,
    }));
    const loopSlotAttachments: TrackSourceAttachment[] = (track.loopSlots ?? []).flatMap(loopSlot =>
      loopSlot.sourceId === null
        ? []
        : [
            {
              kind: 'loop-slot',
              sourceId: loopSlot.sourceId,
              loopSlotId: loopSlot.id,
            },
          ]
    );

    return [...regionAttachments, ...loopSlotAttachments];
  }

  private validateSourceAttachments(attachments: readonly TrackSourceAttachment[]): void {
    attachments.forEach(attachment => {
      const source = this.audioSourceRegistry.resolve(attachment.sourceId);
      const isAttached =
        attachment.kind === 'region'
          ? source?.regionIds.includes(attachment.regionId)
          : source?.loopSlotIds?.includes(attachment.loopSlotId);
      if (isAttached) {
        return;
      }

      throw new ProjectStateError(
        attachment.kind === 'region'
          ? ProjectStateErrorCode.REGION_SOURCE_MISSING
          : ProjectStateErrorCode.LOOP_SLOT_SOURCE_MISSING,
        `Source 연결을 찾을 수 없습니다: ${this.getAttachmentId(attachment)}`,
        { ...attachment }
      );
    });
  }

  private detachSourceAttachments(attachments: readonly TrackSourceAttachment[]): TrackSourceAttachment[] {
    const detachedAttachments: TrackSourceAttachment[] = [];

    try {
      attachments.forEach(attachment => {
        this.detachSourceAttachment(attachment);
        detachedAttachments.push(attachment);
      });
    } catch (cause) {
      this.restoreSourceAttachments({
        attachments: [...detachedAttachments].reverse(),
        cause,
        failedPhase: 'Source 연결 분리',
      });
      throw cause;
    }

    return detachedAttachments;
  }

  private restoreSourceAttachments({
    attachments,
    cause,
    failedPhase,
  }: {
    attachments: readonly TrackSourceAttachment[];
    cause: unknown;
    failedPhase: string;
  }): void {
    const compensationFailures = attachments.flatMap(attachment => {
      try {
        this.restoreSourceAttachment(attachment);
        return [];
      } catch (compensationCause) {
        return [{ step: `Source 연결 복원: ${this.getAttachmentId(attachment)}`, cause: compensationCause }];
      }
    });

    if (compensationFailures.length > 0) {
      throw new ProjectMutationCompensationError({
        operation: 'remove-track',
        failedPhase,
        cause,
        compensationFailures,
      });
    }
  }

  private detachSourceAttachment(attachment: TrackSourceAttachment): void {
    if (attachment.kind === 'region') {
      this.audioSourceRegistry.detach(attachment);
      return;
    }

    this.audioSourceRegistry.detachLoopSlot(attachment);
  }

  private restoreSourceAttachment(attachment: TrackSourceAttachment): void {
    if (attachment.kind === 'region') {
      this.audioSourceRegistry.attach(attachment);
      return;
    }

    this.audioSourceRegistry.attachLoopSlot(attachment);
  }

  private getAttachmentId(attachment: TrackSourceAttachment): string {
    return attachment.kind === 'region' ? attachment.regionId : attachment.loopSlotId;
  }
}
