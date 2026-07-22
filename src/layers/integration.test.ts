import { describe, it, expect, vi } from 'vitest';
import { MockAudioEngine } from './audio-engine/mock-audio-engine';
import { createApp } from './apps/create-app';
import { InMemoryProjectRepository } from './project-repository/in-memory-project-repository';
import { AudioCommandType } from './shared/types/audioCommand.schema';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';

describe('Layers Integration', () => {
  function setup() {
    const mockEngine = new MockAudioEngine();
    const { session, commandExecutor } = createApp({
      audioEngine: mockEngine,
      projectRepository: new InMemoryProjectRepository(),
    });
    return { mockEngine, session, commandExecutor };
  }

  describe('Playback 명령', () => {
    it('play 시 isPlaying이 true가 된다', async () => {
      const { session, commandExecutor } = setup();

      await commandExecutor.execute({ type: AudioCommandType.PLAY });

      expect(session.getState().isPlaying).toBe(true);
    });

    it('stop 시 isPlaying이 false가 된다', async () => {
      const { session, commandExecutor } = setup();
      await commandExecutor.execute({ type: AudioCommandType.PLAY });
      await commandExecutor.execute({ type: AudioCommandType.SET_CURRENT_TIME, time: 5 });

      await commandExecutor.execute({ type: AudioCommandType.STOP });

      expect(session.getState().isPlaying).toBe(false);
      expect(session.getState().currentTime).toBe(0);
    });

    it('pause 시 isPlaying이 false가 된다', async () => {
      const { session, commandExecutor } = setup();
      await commandExecutor.execute({ type: AudioCommandType.PLAY });

      await commandExecutor.execute({ type: AudioCommandType.PAUSE });

      expect(session.getState().isPlaying).toBe(false);
    });
  });

  describe('Track 명령', () => {
    it('트랙을 추가하면 tracks에 반영된다', async () => {
      const { session, commandExecutor } = setup();

      await commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId: TRACK_ID });

      const tracks = session.getState().tracks;
      expect(tracks.size).toBe(1);
      expect(tracks.get(TRACK_ID)?.id).toBe(TRACK_ID);
      expect(tracks.get(TRACK_ID)?.volume).toBe(1.0);
    });

    it('트랙 볼륨을 변경하면 session에 반영된다', async () => {
      const { session, commandExecutor } = setup();
      await commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId: TRACK_ID });

      await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_VOLUME, trackId: TRACK_ID, volume: 0.5 });

      expect(session.getState().tracks.get(TRACK_ID)?.volume).toBe(0.5);
    });

    it('트랙을 제거하면 tracks에서 사라진다', async () => {
      const { session, commandExecutor } = setup();
      await commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId: TRACK_ID });

      await commandExecutor.execute({ type: AudioCommandType.REMOVE_TRACK, trackId: TRACK_ID });

      expect(session.getState().tracks.size).toBe(0);
    });
  });

  describe('Session subscribe', () => {
    it('상태 변경 시 listener가 호출된다', async () => {
      const { session, commandExecutor } = setup();
      const listener = vi.fn();
      session.subscribe(listener);

      await commandExecutor.execute({ type: AudioCommandType.PLAY });
      await commandExecutor.execute({ type: AudioCommandType.STOP });

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('unsubscribe 후에는 listener가 호출되지 않는다', async () => {
      const { session, commandExecutor } = setup();
      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);

      await commandExecutor.execute({ type: AudioCommandType.PLAY });
      unsubscribe();
      await commandExecutor.execute({ type: AudioCommandType.STOP });

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
