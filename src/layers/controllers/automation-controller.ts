import type { IAudioEngine, SetAutomationLanesRequest } from '../audio-engine/i-audio-engine';
import type { SessionStore, TrackState } from '../session/session';
import { cloneAutomationLaneState, getAutomationTargetKey } from '../shared/types/automation-state';
import { ProjectMutationCompensationError } from './project-mutation-compensation-error';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

interface AutomationControllerDependencies {
  readonly audioEngine: IAudioEngine;
  readonly sessionStore: SessionStore;
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
}
