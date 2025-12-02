export interface AudioEngineConfig {
  sampleRate?: number;
  bpm?: number;
  masterVolume?: number;
}

// DAW 데이터 모델 타입 (moved from models.ts)
export interface AudioClipData {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  volume: number;
  muted: boolean;
}

export interface PlaylistItemData {
  regionId: string;
  position: number;
  layer: number;
}

export interface PlaylistData {
  name: string;
  items: PlaylistItemData[];
}

export interface TrackData {
  id: string;
  name: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  playlist?: PlaylistData; // Playlist 정보 (Ardour 스타일)
  clips: AudioClipData[]; // 호환성을 위해 유지
}

export interface RegionData {
  id: string;
  sourceId: string; // AudioBuffer 캐싱용 ID
  name: string;
  start: number;
  length: number;
  muted: boolean;
  locked: boolean;
}

export interface ProjectData {
  name: string;
  bpm: number;
  sampleRate: number;
  tracks: TrackData[];
  playlists?: PlaylistData[]; // 사용되지 않는 Playlist 포함 (Ardour 스타일)
  regions?: RegionData[]; // Region 정보 (세션 로드용)
}

export interface AudioEngineState {
  isPlaying: boolean;
  position: number;
  bpm: number;
  masterVolume: number;
}
