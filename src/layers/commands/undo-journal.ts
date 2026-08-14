import { readProjectDocumentV17 } from '../shared/types/project-document-reader';
import { PROJECT_DOCUMENT_SCHEMA_VERSION_V19, type ProjectDocumentV17 } from '../shared/types/project-document.schema';

const STORAGE_KEY = 'drop-ai:undo-journals:v1';
const MAX_JOURNAL_ENTRIES = 20;

export interface UndoJournalEntry {
  readonly afterDocument: ProjectDocumentV17;
  readonly beforeDocument: ProjectDocumentV17;
  readonly label: string;
}

export interface UndoJournalSnapshot {
  readonly redoEntries: readonly UndoJournalEntry[];
  readonly undoEntries: readonly UndoJournalEntry[];
}

interface StoredUndoJournal extends UndoJournalSnapshot {
  readonly projectId: string;
  readonly projectRevision: number;
  readonly schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION_V19;
}

export interface IUndoJournal {
  clear(projectId: string): void;
  load(projectId: string, projectRevision: number): UndoJournalSnapshot;
  record(projectId: string, projectRevision: number, entry: UndoJournalEntry): void;
  redo(projectId: string): void;
  undo(projectId: string): void;
  updateRevision(projectId: string, projectRevision: number): void;
}

function emptySnapshot(): UndoJournalSnapshot {
  return { redoEntries: [], undoEntries: [] };
}

export class BrowserUndoJournal implements IUndoJournal {
  private readonly journals = new Map<string, StoredUndoJournal>();

  constructor(private readonly storage?: Storage) {
    this.readStorage();
  }

  load(projectId: string, projectRevision: number): UndoJournalSnapshot {
    const journal = this.journals.get(projectId);
    if (!journal) {
      return emptySnapshot();
    }
    if (journal.schemaVersion !== PROJECT_DOCUMENT_SCHEMA_VERSION_V19 || journal.projectRevision !== projectRevision) {
      this.clear(projectId);
      return emptySnapshot();
    }
    try {
      return {
        redoEntries: journal.redoEntries.map(entry => this.readEntry(entry)),
        undoEntries: journal.undoEntries.map(entry => this.readEntry(entry)),
      };
    } catch {
      this.clear(projectId);
      return emptySnapshot();
    }
  }

  record(projectId: string, projectRevision: number, entry: UndoJournalEntry): void {
    const current = this.journals.get(projectId);
    const undoEntries = [...(current?.undoEntries ?? []), entry].slice(-MAX_JOURNAL_ENTRIES);
    this.journals.set(projectId, {
      projectId,
      projectRevision,
      redoEntries: [],
      schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V19,
      undoEntries,
    });
    this.writeStorage();
  }

  undo(projectId: string): void {
    const journal = this.journals.get(projectId);
    const entry = journal?.undoEntries.at(-1);
    if (!journal || !entry) {
      return;
    }
    this.journals.set(projectId, {
      ...journal,
      redoEntries: [...journal.redoEntries, entry],
      undoEntries: journal.undoEntries.slice(0, -1),
    });
    this.writeStorage();
  }

  redo(projectId: string): void {
    const journal = this.journals.get(projectId);
    const entry = journal?.redoEntries.at(-1);
    if (!journal || !entry) {
      return;
    }
    this.journals.set(projectId, {
      ...journal,
      redoEntries: journal.redoEntries.slice(0, -1),
      undoEntries: [...journal.undoEntries, entry].slice(-MAX_JOURNAL_ENTRIES),
    });
    this.writeStorage();
  }

  updateRevision(projectId: string, projectRevision: number): void {
    const journal = this.journals.get(projectId);
    if (!journal) {
      return;
    }
    this.journals.set(projectId, { ...journal, projectRevision });
    this.writeStorage();
  }

  clear(projectId: string): void {
    this.journals.delete(projectId);
    this.writeStorage();
  }

  private readEntry(entry: UndoJournalEntry): UndoJournalEntry {
    return {
      afterDocument: readProjectDocumentV17(entry.afterDocument),
      beforeDocument: readProjectDocumentV17(entry.beforeDocument),
      label: entry.label,
    };
  }

  private readStorage(): void {
    if (!this.storage) {
      return;
    }
    try {
      const stored = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? '[]') as unknown;
      if (!Array.isArray(stored)) {
        return;
      }
      stored.forEach(candidate => {
        if (typeof candidate !== 'object' || candidate === null) {
          return;
        }
        const journal = candidate as StoredUndoJournal;
        if (typeof journal.projectId === 'string') {
          this.journals.set(journal.projectId, journal);
        }
      });
    } catch {
      this.storage.removeItem(STORAGE_KEY);
    }
  }

  private writeStorage(): void {
    if (!this.storage) {
      return;
    }
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify([...this.journals.values()]));
    } catch {
      this.storage.removeItem(STORAGE_KEY);
    }
  }
}
