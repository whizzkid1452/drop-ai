import { createStore } from 'zustand/vanilla';

export interface RegionState {
  id: string;
  trackId: string;
  src: string; // Blob URL
  startTime: number; // Timeline position (seconds)
  duration: number; // Region length (seconds)
  offset: number; // Start point within buffer (seconds)
}

export interface TrackState {
  id: string;
  name: string;
  volume: number;
  isMuted: boolean;
  isSoloed: boolean;
  pan: number;
  regions: RegionState[];
}

// State (Data)
//프로젝트의 상태값들
export interface SessionData {
  isPlaying: boolean;
  masterVolume: number;
  bpm: number;
  isLooping: boolean;
  loopStart: number;
  loopEnd: number;
  tracks: Map<string, TrackState>;
}

// Actions (Setters) 액션함수들들
export interface SessionActions {
  //setPlaying은 boolean 값을 인자로 받습니다. 반환값은 없으므로 반환 타입은 void 입니다.
  setPlaying: (playing: boolean) => void;
  setMasterVolume: (volume: number) => void;
  setBpm: (bpm: number) => void;
  setLoop: (isLooping: boolean) => void;
  setLoopPoints: (start: number, end: number) => void;
  addTrack: (track: TrackState) => void;
  updateTrack: (id: string, updates: Partial<TrackState>) => void; //TrackState의 모든 속성이 선택(optional)인 타입
  // 변경하고싶은 필드만 담는 객체! Partial
  // 업데이트 문맥: updateTrack(id, updates: Partial<TrackState>)
  // 설정/옵션 문맥: createPlayer(options: Partial<PlayerConfig>)
  removeTrack: (id: string) => void;
  addRegion: (trackId: string, region: RegionState) => void;
  updateRegion: (
    trackId: string,
    regionId: string,
    updates: Partial<RegionState>
  ) => void;
  removeRegion: (trackId: string, regionId: string) => void;
}

export interface SessionState extends SessionData, SessionActions {}

export type SessionStore = ReturnType<typeof createSessionStore>;
//세션스토어의 타입은 createSessionStore의 반환타입으로 정의합니다.(추론해서 타입 재사용)

//zustand vanilla creatStore함수
// createStore<State>((set, get) => ({
// 초기 state 값들
// action 함수들
// }));
export function createSessionStore() {
  return createStore<SessionState>(set => ({
    //set을 인자로 받는 초기화함수
    isPlaying: false,
    masterVolume: 1.0,
    bpm: 120,
    isLooping: false,
    loopStart: 0,
    loopEnd: 4,
    tracks: new Map(), //트랙 추가/삭제/조회가 많고 키 기반 접근이 많다. id 식별자 기반으로 자주 조회, 수정, 삭제..

    //액션 함수로는
    setPlaying: playing => set({ isPlaying: playing }),

    setMasterVolume: volume => set({ masterVolume: volume }),

    setBpm: bpm => set({ bpm }),

    setLoop: isLooping => set({ isLooping }),

    setLoopPoints: (start, end) => set({ loopStart: start, loopEnd: end }),

    //addTrack 액션함수는 track을 인자로 받아 set을 실행합니다.
    //객체를 반환해 상태를 갱신합니다.
    addTrack: track =>
      set(state => {
        //set 실행. state를 인자로 받아서 다음 함수를 실행한다.
        const newTracks = new Map(state.tracks); //내부에서 기존 state.tracks를 복사해 new Map으로 newTracks를 만들고,
        newTracks.set(track.id, track); //track.id를 키로 track을 추가한 뒤
        return { tracks: newTracks };
      }),

    updateTrack: (id, updates) =>
      set(state => {
        const track = state.tracks.get(id);
        if (!track) return state;
        const newTracks = new Map(state.tracks);
        newTracks.set(id, { ...track, ...updates });
        return { tracks: newTracks };
      }),

    removeTrack: id =>
      set(state => {
        const newTracks = new Map(state.tracks);
        newTracks.delete(id);
        return { tracks: newTracks };
      }),

    addRegion: (trackId, region) =>
      set(state => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const newRegions = [...track.regions, region];
        const newTrack = { ...track, regions: newRegions }; //regions, tracks를 불변 방식으로 복사-갱신 후 반환한다.
        const newTracks = new Map(state.tracks);
        newTracks.set(trackId, newTrack);
        return { tracks: newTracks };
      }),

    updateRegion: (trackId, regionId, updates) =>
      set(state => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const newRegions = track.regions.map(r =>
          r.id === regionId ? { ...r, ...updates } : r
        );
        const newTrack = { ...track, regions: newRegions };
        const newTracks = new Map(state.tracks);
        newTracks.set(trackId, newTrack);
        return { tracks: newTracks };
      }),

    removeRegion: (trackId, regionId) =>
      set(state => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const newRegions = track.regions.filter(r => r.id !== regionId);
        const newTrack = { ...track, regions: newRegions };
        const newTracks = new Map(state.tracks);
        newTracks.set(trackId, newTrack);
        return { tracks: newTracks };
      }),
  }));
}
