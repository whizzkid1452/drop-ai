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
      loadFile: vi.fn(),
    };

    trackController = new TrackController(sessionStore, audioEngine);
  });

  describe('addTrack', () => {
    // addTrack no longer calls audioEngine.loadUrl
    it('should add track to session store', async () => {
      // Act
      const { id } = await trackController.addTrack();

      // Assert
      const state = sessionStore.getState();
      expect(state.tracks.has(id)).toBe(true);
      expect(state.tracks.get(id)).toEqual({
        id: id,
        volume: 1.0,
        isMuted: false,
        isSoloed: false,
      });
    });
  });

  describe('removeTrack', () => {
    it('should remove track from session store', () => {
      // Arrange
      const trackId = 'track-1';
      sessionStore.setState({
        tracks: new Map([
          [
            trackId,
            { id: trackId, volume: 1.0, isMuted: false, isSoloed: false },
          ],
        ]),
      });

      // Act
      trackController.removeTrack(trackId);

      // Assert
      const state = sessionStore.getState();
      expect(state.tracks.has(trackId)).toBe(false);
    });
  });

  describe('setTrackVolume', () => {
    it('should update track volume in session store', () => {
      // Arrange
      const trackId = 'track-1';
      sessionStore.setState({
        tracks: new Map([
          [
            trackId,
            { id: trackId, volume: 1.0, isMuted: false, isSoloed: false },
          ],
        ]),
      });
      const newVolume = 0.5;

      // Act
      trackController.setTrackVolume(trackId, newVolume);

      // Assert
      const state = sessionStore.getState();
      const track = state.tracks.get(trackId);
      expect(track?.volume).toBe(newVolume);
    });
  });
});
