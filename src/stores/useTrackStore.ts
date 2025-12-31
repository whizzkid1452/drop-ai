import type { Track, Region } from '@/types/track';
import { create } from 'zustand';
import { AudioEngine } from '@/logics/audio/audioEngine';

type NewRegion = Omit<Region, 'id'>;
type NewTrack = Omit<Track, 'id' | 'regions'> & { regions: NewRegion[] };

interface TrackStore {
  tracks: Map<string, Track>;
  getTrack: ({ trackId }: { trackId: string }) => Track | undefined;
  getTracks: () => Map<string, Track>;
  updateTrack: ({
    trackId,
    updater,
  }: {
    trackId: string;
    updater: (track: Track) => Track;
  }) => void;
  addTrack: ({ track }: { track: NewTrack }) => Track;
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
  updateTrack: ({ trackId, updater }) => {
    set(state => {
      const track = state.tracks.get(trackId);
      if (!track) {
        alert('Track not found');
        return {};
      }
      /** @todo 특정 트랙만 변경하기 때문에, 해당 트랙만 레퍼런스 변경 */
      const newTracks = new Map(state.tracks);
      const newTrack: Track = { ...updater(track) };
      newTracks.set(trackId, newTrack);
      return { tracks: newTracks };
    });
  },
  addTrack: ({ track }) => {
    const trackId = crypto.randomUUID();

    const newRegions = track.regions.map(region => ({
      ...region,
      id: crypto.randomUUID(),
    }));

    const newTrack: Track = {
      ...track,
      id: trackId,
      regions: newRegions,
    };

    set(state => {
      /** @note 레퍼런스를 변경하기 위해 새로운 맵을 생성 */
      const newTracks = new Map(state.tracks);
      newTracks.set(trackId, newTrack);
      return { tracks: newTracks };
    });

    return newTrack;
  },
  removeTrack: ({ trackId }) => {
    // 🔴 CRITICAL: Dispose Tone.js resources BEFORE removing from store
    // This prevents memory leaks and background CPU usage
    const disposed = AudioEngine.getInstance().disposeTrack(trackId);
    
    if (!disposed) {
      console.warn(`[TrackStore] Failed to dispose track ${trackId}, but removing from store anyway`);
    }

    set(state => {
      /** @note 레퍼런스를 변경하기 위해 새로운 맵을 생성 */
      const newTracks = new Map(state.tracks);
      newTracks.delete(trackId);
      return { tracks: newTracks };
    });
  },
}));
