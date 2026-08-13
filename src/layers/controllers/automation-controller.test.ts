import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { createSessionStore, type SessionStore } from '../session/session';
import type { AutomationLaneState } from '../shared/types/automation-state';
import { AutomationController } from './automation-controller';
import { ProjectMutationCompensationError } from './project-mutation-compensation-error';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const LANE: AutomationLaneState = {
  id: '22222222-2222-4222-8222-222222222222',
  isEnabled: true,
  target: { kind: 'trackVolume' },
  points: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      interpolation: 'linear',
      timeSeconds: 0,
      value: 0.5,
    },
  ],
};

describe('AutomationController', () => {
  let audioEngine: MockAudioEngine;
  let sessionStore: SessionStore;
  let controller: AutomationController;

  beforeEach(async () => {
    audioEngine = new MockAudioEngine();
    sessionStore = createSessionStore({
      initialProjectMetadata: {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Automation test',
        revision: 0,
      },
    });
    await audioEngine.addTrack(TRACK_ID);
    sessionStore.getState().addTrack({
      id: TRACK_ID,
      isMuted: false,
      isSoloed: false,
      name: 'Track 1',
      pan: 0,
      pluginInstances: [],
      regions: [],
      status: [],
      volume: 1,
    });
    controller = new AutomationController({ audioEngine, sessionStore });
  });

  it('runtime 적용 뒤 Session의 lane을 갱신한다', () => {
    const runtimeSpy = vi.spyOn(audioEngine, 'setAutomationLanes');

    controller.setTrackAutomation({ automationLanes: [LANE], trackId: TRACK_ID });

    expect(runtimeSpy).toHaveBeenCalledWith({ automationLanes: [LANE], trackId: TRACK_ID });
    expect(sessionStore.getState().tracks.get(TRACK_ID)?.automationLanes).toEqual([LANE]);
  });

  it('Session 갱신 실패 시 runtime을 이전 lane으로 복원한다', () => {
    const runtimeSpy = vi.spyOn(audioEngine, 'setAutomationLanes');
    vi.spyOn(sessionStore.getState(), 'updateTrack').mockImplementationOnce(() => {
      throw new Error('session update failed');
    });

    expect(() => controller.setTrackAutomation({ automationLanes: [LANE], trackId: TRACK_ID })).toThrowError(
      'session update failed'
    );
    expect(runtimeSpy).toHaveBeenLastCalledWith({ automationLanes: [], trackId: TRACK_ID });
  });

  it('Session 갱신과 runtime 복원이 모두 실패하면 보상 실패 정보를 보존한다', () => {
    const sessionFailure = new Error('session update failed');
    const compensationFailure = new Error('runtime restore failed');
    vi.spyOn(audioEngine, 'setAutomationLanes')
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw compensationFailure;
      });
    vi.spyOn(sessionStore.getState(), 'updateTrack').mockImplementationOnce(() => {
      throw sessionFailure;
    });

    let thrownError: unknown;
    try {
      controller.setTrackAutomation({ automationLanes: [LANE], trackId: TRACK_ID });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(ProjectMutationCompensationError);
    expect(thrownError).toMatchObject({
      cause: sessionFailure,
      compensationFailures: [{ cause: compensationFailure, step: 'Automation runtime 복원' }],
      failedPhase: 'Session Automation 저장',
      operation: 'Track Automation 변경',
    });
  });
});
