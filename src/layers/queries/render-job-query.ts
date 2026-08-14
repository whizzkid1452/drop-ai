import type { RenderJobState, RenderJobStateListener } from '../shared/types/render-job';

export interface IRenderJobQuerySource {
  getRenderJobState(): RenderJobState;
  subscribeRenderJobState(listener: RenderJobStateListener): () => void;
}

export interface IRenderJobQuery {
  readState(): RenderJobState;
  subscribe(listener: () => void): () => void;
}

export class RenderJobQuery implements IRenderJobQuery {
  private cachedState: RenderJobState | null = null;

  constructor(private readonly source: IRenderJobQuerySource) {}

  readState(): RenderJobState {
    const nextState = this.source.getRenderJobState();
    if (this.cachedState && areRenderJobStatesEqual(this.cachedState, nextState)) {
      return this.cachedState;
    }
    this.cachedState = { ...nextState };
    return this.cachedState;
  }

  subscribe(listener: () => void): () => void {
    return this.source.subscribeRenderJobState(() => listener());
  }
}

function areRenderJobStatesEqual(left: RenderJobState, right: RenderJobState): boolean {
  return (
    left.completedFileCount === right.completedFileCount &&
    left.errorMessage === right.errorMessage &&
    left.jobId === right.jobId &&
    left.outputFileCount === right.outputFileCount &&
    left.progress === right.progress &&
    left.stage === right.stage &&
    left.status === right.status
  );
}
