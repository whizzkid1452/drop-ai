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
      getCurrentTime: vi.fn(),
      createTrack: vi.fn(),
      // setTrackSource remove
      // getTrackDuration remove
      removeTrack: vi.fn(),
      setTrackVolume: vi.fn(),
      setTrackSolo: vi.fn(),
      setTrackMute: vi.fn(),
      loadFile: vi.fn().mockResolvedValue({ src: 'blob:url', duration: 120 }),
      addRegion: vi.fn(),
      removeRegion: vi.fn(),
      getDebugInfo: vi.fn(),
      moveRegion: vi.fn(),
      setTrackPan: vi.fn(),
      setLoop: vi.fn(),
      setLoopPoints: vi.fn(),
      setBpm: vi.fn(),
      exportSession: vi.fn(),
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
        volume: 1.0,
        isMuted: false,
        isSoloed: false,
        pan: 0,
        regions: [],
      });

      expect(audioEngine.createTrack).toHaveBeenCalledWith(track.id);
    });
  });

  describe('addRegion', () => {
    it('should load file and add region to session and audio engine', async () => {
      const { id: trackId } = await trackController.addTrack();
      const file = new File([''], 'test.mp3', { type: 'audio/mp3' });

      await trackController.addRegion(trackId, file, 0);

      const track = sessionStore.getState().tracks.get(trackId);
      expect(track?.regions).toHaveLength(1);
      expect(track?.regions[0]).toEqual({
        id: expect.any(String),
        trackId,
        src: 'blob:url',
        startTime: 0,
        duration: 120,
        offset: 0,
      });

      expect(audioEngine.loadFile).toHaveBeenCalledWith(file);
      expect(audioEngine.addRegion).toHaveBeenCalledWith(
        trackId,
        expect.any(Object)
      );
    });
  });

  describe('removeRegion', () => {
    it('should remove region from session and audio engine', async () => {
      const { id: trackId } = await trackController.addTrack();
      const file = new File([''], 'test.mp3', { type: 'audio/mp3' });
      const { regionId } = await trackController.addRegion(trackId, file, 0);

      trackController.removeRegion(trackId, regionId);

      const track = sessionStore.getState().tracks.get(trackId);
      expect(track?.regions).toHaveLength(0);
      expect(audioEngine.removeRegion).toHaveBeenCalledWith(trackId, regionId);
    });
  });

  describe('splitRegion', () => {
    it('should split region into two and update session/audio engine', async () => {
      const { id: trackId } = await trackController.addTrack();
      const file = new File([''], 'test.mp3', { type: 'audio/mp3' });
      const { regionId } = await trackController.addRegion(trackId, file, 0);

      const { leftId, rightId } = trackController.splitRegion(
        trackId,
        regionId,
        30
      );

      const track = sessionStore.getState().tracks.get(trackId);
      expect(track?.regions).toHaveLength(2);

      const left = track?.regions.find(r => r.id === leftId);
      const right = track?.regions.find(r => r.id === rightId);

      expect(left).toMatchObject({ startTime: 0, duration: 30, offset: 0 });
      expect(right).toMatchObject({ startTime: 30, duration: 90, offset: 30 });

      // Logic changed: resizeRegion is used, so original region is removed/added (updated)
      // and new right region is added.
      // Left ID is now same as original region ID.
      expect(leftId).toBe(regionId);

      // Verify Audio Engine Calls
      // resizeRegion calls remove/add for original ID
      expect(audioEngine.removeRegion).toHaveBeenCalledWith(trackId, regionId);
      expect(audioEngine.addRegion).toHaveBeenCalledWith(
        trackId,
        expect.objectContaining({ id: regionId, duration: 30 })
      );

      // Right region added
      expect(audioEngine.addRegion).toHaveBeenCalledWith(
        trackId,
        expect.objectContaining({ id: rightId })
      );
    });
  });

  describe('resizeRegion', () => {
    it('should resize region and update session/audio engine', async () => {
      const { id: trackId } = await trackController.addTrack();
      const file = new File([''], 'test.mp3', { type: 'audio/mp3' });
      const { regionId } = await trackController.addRegion(trackId, file, 0);

      trackController.resizeRegion(trackId, regionId, 60);

      const track = sessionStore.getState().tracks.get(trackId);
      const region = track?.regions.find(r => r.id === regionId);

      expect(region?.duration).toBe(60);
      expect(audioEngine.removeRegion).toHaveBeenCalledWith(trackId, regionId);
      expect(audioEngine.addRegion).toHaveBeenCalledWith(
        trackId,
        expect.objectContaining({ id: regionId, duration: 60 })
      );
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
              volume: 1.0,
              isMuted: false,
              isSoloed: false,
              pan: 0,
              regions: [],
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
              volume: 1.0,
              isMuted: false,
              isSoloed: false,
              pan: 0,
              regions: [],
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
