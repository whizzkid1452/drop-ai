export const EXPORT_FORMATS = ['wav'] as const;
export const EXPORT_SAMPLE_FORMATS = ['pcm16', 'pcm24', 'float32'] as const;
export const EXPORT_CHANNEL_MODES = ['mono', 'stereo'] as const;
export const EXPORT_DITHER_MODES = ['none', 'tpdf'] as const;
export const EXPORT_MODES = ['mix', 'stems'] as const;
export const EXPORT_NORMALIZATION_MODES = ['none', 'peak', 'lufs'] as const;
export const DEFAULT_EXPORT_PRESET_ID = 'default-wav';

export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export type ExportSampleFormat = (typeof EXPORT_SAMPLE_FORMATS)[number];
export type ExportChannelMode = (typeof EXPORT_CHANNEL_MODES)[number];
export type ExportDitherMode = (typeof EXPORT_DITHER_MODES)[number];
export type ExportMode = (typeof EXPORT_MODES)[number];

export type ExportNormalizationState =
  | { readonly mode: 'none' }
  | { readonly mode: 'peak'; readonly targetDbfs: number }
  | { readonly mode: 'lufs'; readonly targetLufs: number };

export interface ExportPresetState {
  readonly id: string;
  readonly name: string;
  readonly format: ExportFormat;
  readonly sampleFormat: ExportSampleFormat;
  readonly sampleRate: number;
  readonly channelMode: ExportChannelMode;
  readonly dither: ExportDitherMode;
  readonly normalization: ExportNormalizationState;
  readonly exportMode: ExportMode;
}

export interface ExportRangeState {
  readonly id: string;
  readonly name: string;
  readonly startTimeSeconds: number;
  readonly endTimeSeconds: number;
}

export interface ProjectExportState {
  readonly activePresetId: string;
  readonly presets: readonly ExportPresetState[];
  readonly ranges: readonly ExportRangeState[];
}

export function createDefaultExportPreset(): ExportPresetState {
  return {
    channelMode: 'stereo',
    dither: 'tpdf',
    exportMode: 'mix',
    format: 'wav',
    id: DEFAULT_EXPORT_PRESET_ID,
    name: 'WAV 16-bit / 44.1 kHz',
    normalization: { mode: 'none' },
    sampleFormat: 'pcm16',
    sampleRate: 44_100,
  };
}

export function createDefaultProjectExportState(): ProjectExportState {
  return {
    activePresetId: DEFAULT_EXPORT_PRESET_ID,
    presets: [createDefaultExportPreset()],
    ranges: [],
  };
}

export function cloneProjectExportState(state: ProjectExportState): ProjectExportState {
  return {
    activePresetId: state.activePresetId,
    presets: state.presets.map(preset => ({
      ...preset,
      normalization: { ...preset.normalization },
    })),
    ranges: state.ranges.map(range => ({ ...range })),
  };
}
