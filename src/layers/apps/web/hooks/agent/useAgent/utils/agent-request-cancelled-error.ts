export class AgentRequestCancelledError extends Error {
  constructor() {
    super('Agent request was cancelled');
    this.name = 'AgentRequestCancelledError';
  }
}

export function throwIfAgentRequestCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AgentRequestCancelledError();
  }
}

export function isAgentRequestCancelledError(error: unknown): error is AgentRequestCancelledError {
  return error instanceof AgentRequestCancelledError;
}
