import { describe, expect, it, vi } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { createSessionStore } from '../session/session';
import { MixerController } from './mixer-controller';
import { ProjectStateErrorCode } from './project-state-error';

const INITIAL_PROJECT_METADATA = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Mixer 테스트',
  revision: 0,
};
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const BUS_ID = '33333333-3333-4333-8333-333333333333';

function createTrack(id: string) {
  return {
    id,
    isMuted: false,
    isSoloed: false,
    name: id,
    pan: 0,
    pluginInstances: [],
    regions: [],
    status: [],
    volume: 1,
  };
}

function createTestContext() {
  const audioEngine = new MockAudioEngine();
  const sessionStore = createSessionStore({ initialProjectMetadata: INITIAL_PROJECT_METADATA });
  const controller = new MixerController({ audioEngine, sessionStore });
  return { audioEngine, controller, sessionStore };
}

describe('MixerController', () => {
  it('AudioEngine 성공 뒤 Session Master Volume을 변경한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    const setMasterVolume = vi.spyOn(audioEngine, 'setMasterVolume');

    controller.setMasterVolume(0.5);

    expect(setMasterVolume).toHaveBeenCalledWith(0.5);
    expect(audioEngine.getMasterVolume()).toBe(0.5);
    expect(sessionStore.getState().masterVolume).toBe(0.5);
  });

  it('AudioEngine 변경이 실패하면 Session 값을 유지한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    vi.spyOn(audioEngine, 'setMasterVolume').mockImplementation(() => {
      throw new Error('master volume failed');
    });

    expect(() => controller.setMasterVolume(0.5)).toThrow('master volume failed');
    expect(sessionStore.getState().masterVolume).toBe(1);
  });

  it('Monitor 상태는 저장 Session을 변경하지 않고 runtime에만 반영한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    const projectRevision = sessionStore.getState().project.revision;

    controller.setMonitorState({ isCut: true, isDimmed: false, isMono: true });

    expect(audioEngine.getMonitorState()).toEqual({ isCut: true, isDimmed: false, isMono: true });
    expect(sessionStore.getState().project.revision).toBe(projectRevision);
  });

  it('Track 출력을 Bus로 연결하고 runtime 성공 뒤 Session에 반영한다', async () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    await audioEngine.addTrack(TRACK_ID);
    await audioEngine.addTrack(BUS_ID);
    sessionStore.getState().addTrack(createTrack(TRACK_ID));
    sessionStore.getState().addTrack(createTrack(BUS_ID));
    controller.setTrackRouting({ channelCount: 2, kind: 'bus', output: { kind: 'master' }, trackId: BUS_ID });

    controller.setTrackRouting({
      channelCount: 2,
      kind: 'audio',
      output: { kind: 'track', trackId: BUS_ID },
      trackId: TRACK_ID,
    });

    expect(audioEngine.getRoutingGraph()).toEqual(sessionStore.getState().routingGraph);
    expect(sessionStore.getState().routingGraph.routes[0]?.output).toEqual({ kind: 'track', trackId: BUS_ID });
  });

  it('순환 Send는 AudioEngine 호출 전에 거부한다', async () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    await audioEngine.addTrack(TRACK_ID);
    await audioEngine.addTrack(BUS_ID);
    sessionStore.getState().addTrack(createTrack(TRACK_ID));
    sessionStore.getState().addTrack(createTrack(BUS_ID));
    controller.setTrackRouting({ channelCount: 2, kind: 'bus', output: { kind: 'master' }, trackId: BUS_ID });
    controller.setTrackRouting({
      channelCount: 2,
      kind: 'aux',
      output: { kind: 'track', trackId: BUS_ID },
      trackId: TRACK_ID,
    });
    const setRoutingGraph = vi.spyOn(audioEngine, 'setRoutingGraph');

    expect(() =>
      controller.addSend({
        destinationTrackId: TRACK_ID,
        gain: 1,
        id: '44444444-4444-4444-8444-444444444444',
        isEnabled: true,
        sourceTrackId: BUS_ID,
        tapPoint: 'postFader',
      })
    ).toThrow('순환');
    expect(setRoutingGraph).not.toHaveBeenCalled();
  });

  it('Send gain Automation이 남아 있으면 Send 제거를 거부한다', async () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    const sendId = '44444444-4444-4444-8444-444444444444';
    await audioEngine.addTrack(TRACK_ID);
    await audioEngine.addTrack(BUS_ID);
    sessionStore.getState().addTrack(createTrack(TRACK_ID));
    sessionStore.getState().addTrack(createTrack(BUS_ID));
    controller.setTrackRouting({ channelCount: 2, kind: 'bus', output: { kind: 'master' }, trackId: BUS_ID });
    controller.addSend({
      destinationTrackId: BUS_ID,
      gain: 0.5,
      id: sendId,
      isEnabled: true,
      sourceTrackId: TRACK_ID,
      tapPoint: 'postFader',
    });
    sessionStore.getState().updateTrack(TRACK_ID, {
      automationLanes: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          isEnabled: true,
          points: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              interpolation: 'hold',
              timeSeconds: 0,
              value: 0.5,
            },
          ],
          target: { kind: 'sendGain', sendId },
        },
      ],
    });
    const setRoutingGraph = vi.spyOn(audioEngine, 'setRoutingGraph');

    expect(() => controller.removeSend(sendId)).toThrowError(
      expect.objectContaining({ code: ProjectStateErrorCode.AUTOMATION_TARGET_IN_USE })
    );
    expect(setRoutingGraph).not.toHaveBeenCalled();

    expect(() =>
      controller.updateSend({ gain: 0.5, id: sendId, isEnabled: false, tapPoint: 'postFader' })
    ).toThrowError(expect.objectContaining({ code: ProjectStateErrorCode.AUTOMATION_TARGET_IN_USE }));
  });
});
