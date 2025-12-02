import type { Track, Clip, AudioEngine } from '../core/audio';
import type { WaveformStyle } from './ui';

export interface UploadedFile {
  id: string;
  file: File;
  buffer: AudioBuffer;
  track: Track;
  clip: Clip;
}

export interface FileUploadProps {
  onFileAdd: (file: File, buffer: AudioBuffer) => void;
}

export interface FileLibraryProps {
  files: UploadedFile[];
  onDeleteFile: (fileId: string) => void;
}

export interface TrackListProps {
  tracks: Track[];
  onTrackVolumeChange: (track: Track, volume: number) => void;
  onTrackMute: (track: Track, muted: boolean) => void;
  onTrackSolo: (track: Track, solo: boolean) => void;
}

export interface TrackTimelineProps {
  engine: AudioEngine;
  tracks: Track[];
  isPlaying: boolean;
  onTrackVolumeChange: (track: Track, volume: number) => void;
  onTrackMute: (track: Track, muted: boolean) => void;
  onTrackSolo: (track: Track, solo: boolean) => void;
  onTrackPanChange?: (track: Track, pan: number) => void;
  onTrackDelete?: (track: Track) => void;
}

export interface TimelineProps {
  tracks: Track[];
  timelineDuration: number;
  onTimelineClick?: (positionSeconds: number) => void;
}

export interface ClipRegionProps {
  clipLeft: number;
  clipWidth: number;
  clipIndex: number;
  buffer: AudioBuffer;
  style?: WaveformStyle;
}

export interface RulerWrapperProps {
  timelineDuration: number;
  playheadRef?: React.RefObject<HTMLDivElement | null>;
  onRulerClick?: (positionSeconds: number) => void;
}

export interface TrackRowProps {
  index: number;
  track: Track;
  timelineScrollRefs: React.MutableRefObject<
    Map<number, HTMLDivElement | null>
  >;
  timelineContentWidthPx: number;
  timelineDuration: number;
  onVolumeChange: (volume: number) => void;
  onMute: (muted: boolean) => void;
  onSolo: (solo: boolean) => void;
  onPanChange?: (pan: number) => void;
  onDelete?: () => void;
  onTimelineClick?: (positionSeconds: number) => void;
}
