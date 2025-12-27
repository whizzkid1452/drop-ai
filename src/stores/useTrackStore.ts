import type { Track } from '@/types/track';
import { create } from 'zustand';

interface TrackStore {
  tracks: Map<string, Track>;
  getTrack: ({ trackId }: { trackId: string }) => Track | undefined;
  getTracks: () => Map<string, Track>;
  addTrack: ({ track }: { track: Track }) => void;
  removeTrack: ({ trackId }: { trackId: string }) => void;
}

export const useTrackStore = create<TrackStore>()((set, get) => ({
  tracks: new Map(),
  getTracks: () => {
    return get().tracks;
  },
  getTrack: ({ trackId }) => {
    return get().tracks.get(trackId);
  },
  addTrack: ({ track }) => {
    set(state => {
      /** @note 레퍼런스를 변경하기 위해 새로운 맵을 생성 */
      const newTracks = new Map(state.tracks);
      newTracks.set(track.id, track);
      return { tracks: newTracks };
    });
  },
  removeTrack: ({ trackId }) => {
    set(state => {
      /** @note 레퍼런스를 변경하기 위해 새로운 맵을 생성 */
      const newTracks = new Map(state.tracks);
      newTracks.delete(trackId);
      return { tracks: newTracks };
    });
  },
}));
