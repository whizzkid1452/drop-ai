import type { IAudioEngine, SetAutomationLanesRequest } from '../audio-engine/i-audio-engine';
import type { SessionStore, TrackState } from '../session/session';
import { applyAutomationWritePass } from '../shared/automation-write-pass';
import type { TimelineRange } from '../shared/types/project-document.schema';
import {
  cloneAutomationLaneState,
  getAutomationTargetKey,
  type AutomationLaneState,
  type AutomationPointState,
} from '../shared/types/automation-state';
import { ProjectMutationCompensationError } from './project-mutation-compensation-error';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

interface AutomationControllerDependencies {
  readonly audioEngine: IAudioEngine;
  readonly sessionStore: SessionStore;
}

export interface AutomationWritePassRequest {
  readonly laneId: string;
  readonly passRange: TimelineRange;
  readonly samples: readonly AutomationPointState[];
  readonly trackId: string;
}

export interface CancelAutomationWritePreviewRequest {
  readonly laneId: string;
  readonly trackId: string;
}

export class AutomationController {
  constructor(private readonly dependencies: AutomationControllerDependencies) {}

  setTrackAutomation(request: SetAutomationLanesRequest): void {
    const track = this.getTrack(request.trackId);
    this.assertValidTargets(track, request);
    const previousLanes = (track.automationLanes ?? []).map(cloneAutomationLaneState);
    const nextLanes = request.automationLanes.map(cloneAutomationLaneState);

    this.dependencies.audioEngine.setAutomationLanes({
      automationLanes: nextLanes,
      trackId: request.trackId,
    });
    try {
      this.dependencies.sessionStore.getState().updateTrack(request.trackId, { automationLanes: nextLanes });
    } catch (cause) {
      try {
        this.dependencies.audioEngine.setAutomationLanes({
          automationLanes: previousLanes,
          trackId: request.trackId,
        });
      } catch (compensationCause) {
        throw new ProjectMutationCompensationError({
          cause,
          compensationFailures: [{ cause: compensationCause, step: 'Automation runtime 복원' }],
          failedPhase: 'Session Automation 저장',
          operation: 'Track Automation 변경',
        });
      }
      throw cause;
    }
  }

  previewAutomationWritePass(request: AutomationWritePassRequest): void {
    this.dependencies.audioEngine.setAutomationLanes({
      automationLanes: this.createWritePassLanes(request),
      trackId: request.trackId,
    });
  }

  commitAutomationWritePass(request: AutomationWritePassRequest): void {
    this.setTrackAutomation({
      automationLanes: this.createWritePassLanes(request),
      trackId: request.trackId,
    });
  }

  cancelAutomationWritePreview(request: CancelAutomationWritePreviewRequest): void {
    const track = this.getTrack(request.trackId);
    this.getLaneIndex(track, request.laneId);
    this.dependencies.audioEngine.setAutomationLanes({
      automationLanes: (track.automationLanes ?? []).map(cloneAutomationLaneState),
      trackId: request.trackId,
    });
  }

  private getTrack(trackId: string): TrackState {
    const track = this.dependencies.sessionStore.getState().tracks.get(trackId);
    if (track) {
      return track;
    }
    throw new ProjectStateError(ProjectStateErrorCode.TRACK_NOT_FOUND, `Track을 찾을 수 없습니다: ${trackId}`, {
      trackId,
    });
  }

  private assertValidTargets(track: TrackState, request: SetAutomationLanesRequest): void {
    const targetKeys = new Set<string>();
    request.automationLanes.forEach(lane => {
      const target = lane.target;
      const targetKey = getAutomationTargetKey(target);
      if (targetKeys.has(targetKey)) {
        throw new Error(`같은 Track에 중복된 Automation target이 있습니다: ${targetKey}`);
      }
      targetKeys.add(targetKey);

      if (target.kind === 'pluginParameter') {
        const instance = track.pluginInstances.find(candidate => candidate.id === target.pluginInstanceId);
        const parameter = instance?.parameters.find(candidate => candidate.id === target.parameterId);
        if (!instance || typeof parameter?.value !== 'number') {
          throw new Error(`Automation 대상 Plugin 숫자 parameter를 찾을 수 없습니다: ${targetKey}`);
        }
      }
      if (target.kind === 'sendGain') {
        const send = this.dependencies.sessionStore
          .getState()
          .routingGraph.sends.find(candidate => candidate.id === target.sendId);
        if (send?.sourceTrackId !== track.id) {
          throw new Error(`Automation 대상 Send가 Track에 속하지 않습니다: ${targetKey}`);
        }
      }
    });
  }

  private createWritePassLanes(request: AutomationWritePassRequest): readonly AutomationLaneState[] {
    const track = this.getTrack(request.trackId);
    const automationLanes = track.automationLanes ?? [];
    const laneIndex = this.getLaneIndex(track, request.laneId);
    return automationLanes.map((lane, index) =>
      index === laneIndex
        ? applyAutomationWritePass({ lane, passRange: request.passRange, samples: request.samples })
        : cloneAutomationLaneState(lane)
    );
  }

  private getLaneIndex(track: TrackState, laneId: string): number {
    const laneIndex = (track.automationLanes ?? []).findIndex(lane => lane.id === laneId);
    if (laneIndex >= 0) {
      return laneIndex;
    }
    throw new ProjectStateError(
      ProjectStateErrorCode.AUTOMATION_LANE_NOT_FOUND,
      `Automation lane을 찾을 수 없습니다: ${laneId}`,
      { laneId, trackId: track.id }
    );
  }
}
