import type { AudioEngineConfig } from '../types/audio';

/**
 * Ardour UI 참고 색상 (reference/ardour/share/web_surfaces/builtin/mixer/main.css)
 * - #ac9b05 : strip mute active
 * - #ba1b25 : scale.css critical
 * - #002f42 : toolkit button 기본
 */
export const TRACK_COLOR_PALETTE = [
  '#c693ff',
  '#a874ff',
  '#dba0ff',
  '#f5b6ff',
  '#8c6be8',
  '#b58dff',
  '#eec8ff',
  '#9f7bff',
  '#cbb2ff',
  '#735acb',
] as const;

export const BEATS_PER_BAR = 4 as const;

/**
 * Ticks per beat (PPQN - Pulses Per Quarter Note)
 * Ardour과 동일하게 1920 사용
 */
export const TICKS_PER_BEAT = 1920 as const;

export const DEFAULT_TIMELINE_DURATION = 30 as const;

export const METRONOME_WORKLET_URL = '/worklets/metronome.js' as const;

export const PIXELS_PER_SECOND = 100 as const;

export const DEFAULT_ENGINE_CONFIG: Required<AudioEngineConfig> = {
  sampleRate: 44100,
  bpm: 120,
  masterVolume: 100,
};
