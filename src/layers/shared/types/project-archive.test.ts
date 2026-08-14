import { describe, expect, it } from 'vitest';
import { readProjectDocumentV19 } from './project-document-reader';
import { createProjectArchiveBlob, readProjectArchiveBlob } from './project-archive';
import type { ProjectDocumentV16 } from './project-document.schema';

function createDocument(byteLength: number) {
  return readProjectDocumentV19({
    audioSources: [
      {
        byteLength,
        durationSeconds: 1,
        fileName: 'take.wav',
        id: '22222222-2222-4222-8222-222222222222',
        mimeType: 'audio/wav',
      },
    ],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: '11111111-1111-4111-8111-111111111111', name: 'Archive', revision: 1 },
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
  } as unknown as ProjectDocumentV16);
}

describe('Project archive', () => {
  it('문서와 Source Blob을 round trip한다', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
    const document = createDocument(blob.size);
    const archive = await createProjectArchiveBlob({
      document,
      sources: [{ blob, metadata: document.audioSources[0] }],
    });

    const restored = await readProjectArchiveBlob(archive);

    expect(restored.document).toEqual(document);
    expect(new Uint8Array(await restored.sources[0].blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('metadata와 다른 Source 크기를 거부한다', async () => {
    const document = createDocument(3);
    const archive = await createProjectArchiveBlob({
      document,
      sources: [{ blob: new Blob([new Uint8Array([1, 2])]), metadata: document.audioSources[0] }],
    });

    await expect(readProjectArchiveBlob(archive)).rejects.toThrow('크기');
  });
});
