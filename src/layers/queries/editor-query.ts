import type { EditorRuntimeListener, EditorRuntimeState } from '../shared/types/editor-runtime';

export interface IEditorQuerySource {
  getState(): EditorRuntimeState;
  subscribe(listener: EditorRuntimeListener): () => void;
}

export interface IEditorQuery {
  readState(): EditorRuntimeState;
  subscribe(listener: () => void): () => void;
}

export class EditorQuery implements IEditorQuery {
  constructor(private readonly source: IEditorQuerySource) {}

  readState(): EditorRuntimeState {
    return this.source.getState();
  }

  subscribe(listener: () => void): () => void {
    return this.source.subscribe(listener);
  }
}
