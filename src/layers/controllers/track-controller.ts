import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { AudioSourceAttachment, IAudioSourceRegistry } from '../audio-source-registry/i-audio-source-registry';
import type { SessionStore, TrackState } from '../session/session';
import { ProjectMutationCompensationError } from './project-mutation-compensation-error';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

interface TrackControllerDependencies {
  sessionStore: SessionStore;
  audioEngine: IAudioEngine;
  audioSourceRegistry: IAudioSourceRegistry;
}

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

  private getSourceAttachments(track: TrackState): AudioSourceAttachment[] {
    return track.regions.map(region => ({ sourceId: region.sourceId, regionId: region.id }));
  }

  private validateSourceAttachments(attachments: readonly AudioSourceAttachment[]): void {
    attachments.forEach(attachment => {
      const source = this.audioSourceRegistry.resolve(attachment.sourceId);
      if (source?.regionIds.includes(attachment.regionId)) {
        return;
      }

      throw new ProjectStateError(
        ProjectStateErrorCode.REGION_SOURCE_MISSING,
        `Region의 Source 연결을 찾을 수 없습니다: ${attachment.regionId}`,
        { ...attachment }
      );
    });
  }

  private detachSourceAttachments(attachments: readonly AudioSourceAttachment[]): AudioSourceAttachment[] {
    const detachedAttachments: AudioSourceAttachment[] = [];

    try {
      attachments.forEach(attachment => {
        this.audioSourceRegistry.detach(attachment);
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
    attachments: readonly AudioSourceAttachment[];
    cause: unknown;
    failedPhase: string;
  }): void {
    const compensationFailures = attachments.flatMap(attachment => {
      try {
        this.audioSourceRegistry.attach(attachment);
        return [];
      } catch (compensationCause) {
        return [{ step: `Source 연결 복원: ${attachment.regionId}`, cause: compensationCause }];
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
}
