const COMMAND_HISTORY_LIMIT = 100;

export interface CommandHistorySnapshot {
  readonly canRedo: boolean;
  readonly canUndo: boolean;
}

export interface CommandHistoryEntry {
  readonly label: string;
  readonly undo: () => Promise<void>;
  readonly redo: () => Promise<void>;
}

export interface ICommandHistoryQuery {
  readonly getSnapshot: () => CommandHistorySnapshot;
  readonly subscribe: (listener: () => void) => () => void;
}

export interface ICommandHistory extends ICommandHistoryQuery {
  clear(): void;
  record(entry: CommandHistoryEntry): void;
  redo(): Promise<void>;
  undo(): Promise<void>;
}

const EMPTY_COMMAND_HISTORY_SNAPSHOT: CommandHistorySnapshot = {
  canRedo: false,
  canUndo: false,
};

export class CommandHistory implements ICommandHistory {
  private readonly listeners = new Set<() => void>();
  private readonly redoEntries: CommandHistoryEntry[] = [];
  private readonly undoEntries: CommandHistoryEntry[] = [];
  private snapshot = EMPTY_COMMAND_HISTORY_SNAPSHOT;

  readonly getSnapshot = (): CommandHistorySnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  record(entry: CommandHistoryEntry): void {
    this.undoEntries.push(entry);
    if (this.undoEntries.length > COMMAND_HISTORY_LIMIT) {
      this.undoEntries.shift();
    }
    this.redoEntries.splice(0);
    this.publishSnapshot();
  }

  async undo(): Promise<void> {
    const entry = this.undoEntries.at(-1);
    if (!entry) {
      return;
    }

    await entry.undo();
    this.undoEntries.pop();
    this.redoEntries.push(entry);
    this.publishSnapshot();
  }

  async redo(): Promise<void> {
    const entry = this.redoEntries.at(-1);
    if (!entry) {
      return;
    }

    await entry.redo();
    this.redoEntries.pop();
    this.undoEntries.push(entry);
    this.publishSnapshot();
  }

  clear(): void {
    this.undoEntries.splice(0);
    this.redoEntries.splice(0);
    this.publishSnapshot();
  }

  private publishSnapshot(): void {
    const nextSnapshot = {
      canRedo: this.redoEntries.length > 0,
      canUndo: this.undoEntries.length > 0,
    };
    if (nextSnapshot.canRedo === this.snapshot.canRedo && nextSnapshot.canUndo === this.snapshot.canUndo) {
      return;
    }

    this.snapshot = nextSnapshot;
    this.listeners.forEach(listener => listener());
  }
}
