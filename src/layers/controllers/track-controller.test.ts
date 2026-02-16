import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackController } from './track-controller';
import { createSessionStore, type SessionStore } from '../session/session';
import type { IAudioEngine } from '../audio-engine/i-audio-engine';

describe('TrackController', () => {
  let sessionStore: SessionStore;
  let audioEngine: IAudioEngine;
  let trackController: TrackController;

  beforeEach(() => {
    // Session Store 초기화
    sessionStore = createSessionStore();

    // Audio Engine Mock
    audioEngine = {
      play: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      setVolume: vi.fn(),
      seekTo: vi.fn(),
      createTrack: vi.fn(),
      setTrackSource: vi.fn(),
      getTrackDuration: vi.fn().mockReturnValue(180),
      removeTrack: vi.fn(),
      setTrackVolume: vi.fn(),
      setTrackSolo: vi.fn(),
      setTrackMute: vi.fn(), // This was in the original and not in the provided snippet, keeping it.
      loadFile: vi.fn(), // This was in the original and not in the provided snippet, keeping it.
    };

    trackController = new TrackController(sessionStore, audioEngine);
  });

  describe('addTrack', () => {
    it('should add track to session store and create audio track', async () => {
      await trackController.addTrack();

      const tracks = sessionStore.getState().tracks;
      expect(tracks.size).toBe(1);
      const track = Array.from(tracks.values())[0];
      expect(track).toEqual({
        id: expect.any(String),
        name: expect.stringContaining('Track'),
        duration: 0,
        volume: 1.0,
        isMuted: false,
        isSoloed: false,
        src: null,
      });

      expect(audioEngine.createTrack).toHaveBeenCalledWith(track.id);
    });
  });

  describe('removeTrack', () => {
    it('should remove track from session store', async () => {
      const id = 'track-1';
      sessionStore.setState({
        tracks: new Map([
          [
            id,
            {
              id,
              name: 'Track 1',
              duration: 0,
              volume: 1.0,
              isMuted: false,
              isSoloed: false,
              src: null,
            },
          ],
        ]),
      });

      trackController.removeTrack(id);

      const tracks = sessionStore.getState().tracks;
      expect(tracks.has(id)).toBe(false);
      expect(audioEngine.removeTrack).toHaveBeenCalledWith(id);
    });
  });

  describe('setTrackVolume', () => {
    it('should update track volume in session store', () => {
      const id = 'track-1';
      sessionStore.setState({
        tracks: new Map([
          [
            id,
            {
              id,
              name: 'Track 1',
              duration: 0,
              volume: 1.0,
              isMuted: false,
              isSoloed: false,
              src: null,
            },
          ],
        ]),
      });

      trackController.setTrackVolume(id, 0.5);

      const track = sessionStore.getState().tracks.get(id);
      expect(track?.volume).toBe(0.5);
      expect(audioEngine.setTrackVolume).toHaveBeenCalledWith(id, 0.5);
    });
  });
});
