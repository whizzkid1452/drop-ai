import { describe, expect, it } from 'vitest';
import { readProjectDocumentV17 } from '../shared/types/project-document-reader';
import type { ProjectDocumentV16 } from '../shared/types/project-document.schema';
import { BrowserUndoJournal } from './undo-journal';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function createDocument() {
  return readProjectDocumentV17({
    audioSources: [],
    documentType: 'drop-ai-project',
    exportRange: null,
    mixer: { masterVolume: 1 },
    project: { id: PROJECT_ID, name: 'Journal', revision: 1 },
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

describe('BrowserUndoJournal', () => {
  it('Undo와 Redo stack 전이를 저장한다', () => {
    const journal = new BrowserUndoJournal();
    const document = createDocument();
    journal.record(PROJECT_ID, 1, { afterDocument: document, beforeDocument: document, label: 'SET_TEMPO' });

    journal.undo(PROJECT_ID);
    expect(journal.load(PROJECT_ID, 1)).toMatchObject({ undoEntries: [], redoEntries: [{ label: 'SET_TEMPO' }] });

    journal.redo(PROJECT_ID);
    expect(journal.load(PROJECT_ID, 1)).toMatchObject({ undoEntries: [{ label: 'SET_TEMPO' }], redoEntries: [] });
  });

  it('project revision이 다르면 journal을 제거한다', () => {
    const journal = new BrowserUndoJournal();
    const document = createDocument();
    journal.record(PROJECT_ID, 1, { afterDocument: document, beforeDocument: document, label: 'SET_TEMPO' });

    expect(journal.load(PROJECT_ID, 2)).toEqual({ undoEntries: [], redoEntries: [] });
    expect(journal.load(PROJECT_ID, 1)).toEqual({ undoEntries: [], redoEntries: [] });
  });
});
