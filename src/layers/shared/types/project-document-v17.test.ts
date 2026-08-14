import { describe, expect, it } from 'vitest';
import { readProjectDocumentV16, readProjectDocumentV17, readProjectDocumentSnapshot } from './project-document-reader';
import { PROJECT_DOCUMENT_SCHEMA_VERSION_V17, type ProjectDocumentV16 } from './project-document.schema';
import { DEFAULT_EXPORT_PRESET_ID } from './export-state';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function createV16Document(): ProjectDocumentV16 {
  return readProjectDocumentV16({
    audioSources: [],
    documentType: 'drop-ai-project',
    exportRange: { endTimeSeconds: 5, startTimeSeconds: 1 },
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'Export', revision: 0 },
    schemaVersion: 7,
    timeline: {
      loop: { isEnabled: false, range: null },
      markers: [],
      meterChanges: [{ beatUnit: 4, beatsPerBar: 4, quarterNotePosition: 0 }],
      metronome: { isEnabled: false, volume: 0.8 },
      tempoBpm: 120,
      tempoChanges: [{ bpm: 120, quarterNotePosition: 0 }],
      timeUnit: 'seconds',
    },
    tracks: [],
  });
}

describe('ProjectDocument v17', () => {
  it('v16 Export Range를 기본 WAV preset과 batch range로 migration한다', () => {
    const migrated = readProjectDocumentV17(createV16Document());

    expect(migrated.schemaVersion).toBe(PROJECT_DOCUMENT_SCHEMA_VERSION_V17);
    expect(migrated.exportSettings).toMatchObject({
      activePresetId: DEFAULT_EXPORT_PRESET_ID,
      presets: [
        {
          channelMode: 'stereo',
          dither: 'tpdf',
          exportMode: 'mix',
          format: 'wav',
          id: DEFAULT_EXPORT_PRESET_ID,
          normalization: { mode: 'none' },
          sampleFormat: 'pcm16',
          sampleRate: 44_100,
        },
      ],
      ranges: [{ endTimeSeconds: 5, name: 'Export 1', startTimeSeconds: 1 }],
    });
    expect(readProjectDocumentSnapshot(migrated)).toEqual(migrated);
  });

  it('존재하지 않는 active preset 참조를 거부한다', () => {
    const document = readProjectDocumentV17(createV16Document());

    expect(() =>
      readProjectDocumentV17({
        ...document,
        exportSettings: { ...document.exportSettings, activePresetId: 'missing-preset' },
      })
    ).toThrowError();
  });

  it('32-bit float preset의 dither를 거부한다', () => {
    const document = readProjectDocumentV17(createV16Document());

    expect(() =>
      readProjectDocumentV17({
        ...document,
        exportSettings: {
          ...document.exportSettings,
          presets: document.exportSettings.presets.map(preset => ({
            ...preset,
            dither: 'tpdf',
            sampleFormat: 'float32',
          })),
        },
      })
    ).toThrowError();
  });
});
