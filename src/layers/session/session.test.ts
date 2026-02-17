import { describe, it, expect, beforeEach } from 'vitest';
import { createSessionStore, type SessionStore } from './session';

describe('SessionStore', () => {
  let sessionStore: SessionStore;

  beforeEach(() => {
    sessionStore = createSessionStore();
  });

  describe('Initial State', () => {
    it('initializes with default values', () => {
      const state = sessionStore.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.masterVolume).toBe(1.0);
      expect(state.tracks.size).toBe(0);
    });
  });

  describe('Actions', () => {
    it('should set isPlaying', () => {
      sessionStore.getState().setPlaying(true);
      expect(sessionStore.getState().isPlaying).toBe(true);

      sessionStore.getState().setPlaying(false);
      expect(sessionStore.getState().isPlaying).toBe(false);
    });

    it('should set masterVolume', () => {
      sessionStore.getState().setMasterVolume(0.5);
      expect(sessionStore.getState().masterVolume).toBe(0.5);
    });

    it('should add a track', () => {
      const track = {
        id: 'track-1',
        name: 'Track 1',
        volume: 0.8,
        isMuted: false,
        isSoloed: false,
        pan: 0,
        regions: [],
      };

      sessionStore.getState().addTrack(track);

      const state = sessionStore.getState();
      expect(state.tracks.has('track-1')).toBe(true);
      expect(state.tracks.get('track-1')).toEqual(track);
    });

    it('should update a track', () => {
      const initialTrack = {
        id: 'track-1',
        name: 'Track 1',
        volume: 0.8,
        isMuted: false,
        isSoloed: false,
        pan: 0,
        regions: [],
      };
      sessionStore.getState().addTrack(initialTrack);

      sessionStore
        .getState()
        .updateTrack('track-1', { volume: 0.5, isMuted: true });

      const updatedTrack = sessionStore.getState().tracks.get('track-1');
      expect(updatedTrack?.volume).toBe(0.5);
      expect(updatedTrack?.isMuted).toBe(true);
      expect(updatedTrack?.isSoloed).toBe(false); // original value preserved
    });

    it('should not update non-existent track', () => {
      sessionStore.getState().updateTrack('non-existent', { volume: 0.5 });
      expect(sessionStore.getState().tracks.size).toBe(0);
    });

    it('should remove a track', () => {
      const track = {
        id: 'track-1',
        name: 'Track 1',
        volume: 0.8,
        isMuted: false,
        isSoloed: false,
        pan: 0,
        regions: [],
      };
      sessionStore.getState().addTrack(track);

      sessionStore.getState().removeTrack('track-1');

      const state = sessionStore.getState();
      expect(state.tracks.has('track-1')).toBe(false);
    });

    it('should add a region to a track', () => {
      const track = {
        id: 'track-1',
        name: 'Track 1',
        volume: 1.0,
        isMuted: false,
        isSoloed: false,
        pan: 0,
        regions: [],
      };
      sessionStore.getState().addTrack(track);

      const region = {
        id: 'region-1',
        trackId: 'track-1',
        src: 'blob:url',
        startTime: 0,
        duration: 10,
        offset: 0,
      };

      sessionStore.getState().addRegion('track-1', region);

      const updatedTrack = sessionStore.getState().tracks.get('track-1');
      expect(updatedTrack?.regions).toHaveLength(1);
      expect(updatedTrack?.regions[0]).toEqual(region);
    });

    it('should remove a region from a track', () => {
      const region = {
        id: 'region-1',
        trackId: 'track-1',
        src: 'blob:url',
        startTime: 0,
        duration: 10,
        offset: 0,
      };
      const track = {
        id: 'track-1',
        name: 'Track 1',
        volume: 1.0,
        isMuted: false,
        isSoloed: false,
        pan: 0,
        regions: [region],
      };
      sessionStore.getState().addTrack(track);

      sessionStore.getState().removeRegion('track-1', 'region-1');

      const updatedTrack = sessionStore.getState().tracks.get('track-1');
      expect(updatedTrack?.regions).toHaveLength(0);
    });
  });
});
