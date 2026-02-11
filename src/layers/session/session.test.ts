import { describe, it, expect, beforeEach } from 'vitest';
import { createSessionStore, type SessionStore } from './session';

describe('Session Store - Phase 1 검증', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = createSessionStore();
  });

  describe('기본 상태 초기화', () => {
    it('isPlaying은 false로 초기화되어야 함', () => {
      expect(store.getState().isPlaying).toBe(false);
    });

    it('currentTime은 0으로 초기화되어야 함', () => {
      expect(store.getState().currentTime).toBe(0);
    });

    it('tempo는 120으로 초기화되어야 함', () => {
      expect(store.getState().tempo).toBe(120);
    });

    it('masterVolume은 1.0으로 초기화되어야 함', () => {
      expect(store.getState().masterVolume).toBe(1.0);
    });

    it('exportStartTime과 exportEndTime은 null로 초기화되어야 함', () => {
      expect(store.getState().exportStartTime).toBe(null);
      expect(store.getState().exportEndTime).toBe(null);
    });

    it('tracks는 빈 Map으로 초기화되어야 함', () => {
      expect(store.getState().tracks).toBeInstanceOf(Map);
      expect(store.getState().tracks.size).toBe(0);
    });
  });

  describe('재생 상태 관리', () => {
    it('setPlaying으로 재생 상태를 변경할 수 있어야 함', () => {
      store.getState().setPlaying(true);
      expect(store.getState().isPlaying).toBe(true);

      store.getState().setPlaying(false);
      expect(store.getState().isPlaying).toBe(false);
    });

    it('setCurrentTime으로 재생 위치를 변경할 수 있어야 함', () => {
      store.getState().setCurrentTime(5.5);
      expect(store.getState().currentTime).toBe(5.5);

      store.getState().setCurrentTime(10.25);
      expect(store.getState().currentTime).toBe(10.25);
    });

    it('setTempo로 템포를 변경할 수 있어야 함', () => {
      store.getState().setTempo(140);
      expect(store.getState().tempo).toBe(140);

      store.getState().setTempo(90);
      expect(store.getState().tempo).toBe(90);
    });
  });

  describe('Export 범위 관리', () => {
    it('setExportRange로 export 범위를 설정할 수 있어야 함', () => {
      store.getState().setExportRange(2.0, 8.0);
      expect(store.getState().exportStartTime).toBe(2.0);
      expect(store.getState().exportEndTime).toBe(8.0);
    });

    it('setExportRange로 export 범위를 null로 설정할 수 있어야 함', () => {
      store.getState().setExportRange(2.0, 8.0);
      store.getState().setExportRange(null, null);
      expect(store.getState().exportStartTime).toBe(null);
      expect(store.getState().exportEndTime).toBe(null);
    });
  });

  describe('Track 관리', () => {
    it('addTrack으로 트랙을 추가할 수 있어야 함', () => {
      const track1 = {
        id: 'track-1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        regions: [],
      };

      store.getState().addTrack(track1);
      expect(store.getState().tracks.size).toBe(1);
      expect(store.getState().tracks.get('track-1')).toEqual(track1);
    });

    it('여러 트랙을 추가할 수 있어야 함', () => {
      const track1 = {
        id: 'track-1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        regions: [],
      };

      const track2 = {
        id: 'track-2',
        volume: 1.0,
        pan: -0.5,
        isMuted: true,
        isSoloed: false,
        regions: [],
      };

      store.getState().addTrack(track1);
      store.getState().addTrack(track2);

      expect(store.getState().tracks.size).toBe(2);
      expect(store.getState().tracks.get('track-1')).toEqual(track1);
      expect(store.getState().tracks.get('track-2')).toEqual(track2);
    });

    it('updateTrack으로 트랙을 업데이트할 수 있어야 함', () => {
      const track = {
        id: 'track-1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        regions: [],
      };

      store.getState().addTrack(track);
      store.getState().updateTrack('track-1', { volume: 0.5, pan: 0.3 });

      const updatedTrack = store.getState().tracks.get('track-1');
      expect(updatedTrack?.volume).toBe(0.5);
      expect(updatedTrack?.pan).toBe(0.3);
      expect(updatedTrack?.isMuted).toBe(false); // 다른 속성은 유지
    });

    it('존재하지 않는 트랙 업데이트 시 상태가 변경되지 않아야 함', () => {
      const initialState = store.getState();
      store.getState().updateTrack('non-existent', { volume: 0.5 });
      expect(store.getState()).toBe(initialState); // 동일한 참조
    });

    it('removeTrack으로 트랙을 제거할 수 있어야 함', () => {
      const track = {
        id: 'track-1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        regions: [],
      };

      store.getState().addTrack(track);
      expect(store.getState().tracks.size).toBe(1);

      store.getState().removeTrack('track-1');
      expect(store.getState().tracks.size).toBe(0);
      expect(store.getState().tracks.get('track-1')).toBeUndefined();
    });
  });

  describe('TrackState 속성 검증 (Phase 1 확장)', () => {
    it('TrackState에 pan 속성이 있어야 함', () => {
      const track = {
        id: 'track-1',
        volume: 0.8,
        pan: 0.5, // Phase 1에서 추가된 속성
        isMuted: false,
        isSoloed: false,
        regions: [],
      };

      store.getState().addTrack(track);
      const addedTrack = store.getState().tracks.get('track-1');
      expect(addedTrack?.pan).toBe(0.5);
    });

    it('TrackState에 regions 배열이 있어야 함', () => {
      const region1 = {
        id: 'region-1',
        startTime: 0,
        sourceStartTime: 0,
        duration: 5.0,
        audioFileUrl: 'test.mp3',
      };

      const track = {
        id: 'track-1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        regions: [region1], // Phase 1에서 추가된 속성
      };

      store.getState().addTrack(track);
      const addedTrack = store.getState().tracks.get('track-1');
      expect(addedTrack?.regions).toHaveLength(1);
      expect(addedTrack?.regions[0]).toEqual(region1);
    });
  });

  describe('상태 불변성 검증', () => {
    it('tracks Map은 업데이트 시마다 새로운 참조여야 함', () => {
      const track1 = {
        id: 'track-1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        regions: [],
      };

      const initialTracks = store.getState().tracks;
      store.getState().addTrack(track1);
      const updatedTracks = store.getState().tracks;

      expect(updatedTracks).not.toBe(initialTracks); // 다른 참조
      expect(updatedTracks.size).toBe(1);
    });

    it('updateTrack 시 Map과 Track 객체 모두 새로운 참조여야 함', () => {
      const track = {
        id: 'track-1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        regions: [],
      };

      store.getState().addTrack(track);
      const tracksBeforeUpdate = store.getState().tracks;
      const trackBeforeUpdate = store.getState().tracks.get('track-1');

      store.getState().updateTrack('track-1', { volume: 0.5 });
      const tracksAfterUpdate = store.getState().tracks;
      const trackAfterUpdate = store.getState().tracks.get('track-1');

      expect(tracksAfterUpdate).not.toBe(tracksBeforeUpdate); // Map 참조 변경
      expect(trackAfterUpdate).not.toBe(trackBeforeUpdate); // Track 객체 참조 변경
    });
  });
});
