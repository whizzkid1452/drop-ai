import type { AgentModelStatus, AgentRunStatus, AgentStatus, Message } from '@/types/agent';
import type { SessionStore } from '../session/session';

export class AgentRuntimeController {
  constructor(private readonly sessionStore: SessionStore) {}

  setModelStatus(status: AgentModelStatus): void {
    this.sessionStore.getState().setAgentModelStatus(status);
  }

  setLoadingProgress(progress: number, text: string): void {
    this.sessionStore.getState().setAgentLoadingProgress(progress, text);
  }

  addMessage(message: Message): void {
    this.sessionStore.getState().addAgentMessage(message);
  }

  updateMessage(id: string, content: string): void {
    this.sessionStore.getState().updateAgentMessage(id, content);
  }

  setStatus(status: AgentStatus): void {
    this.sessionStore.getState().setAgentStatus(status);
  }

  setRunStatus(status: AgentRunStatus): void {
    this.sessionStore.getState().setAgentRunStatus(status);
  }

  markResultSuccessful(): void {
    this.sessionStore.getState().markAgentResultSuccessful();
  }

  resetWorkflow(): void {
    this.sessionStore.getState().resetAgentWorkflow();
  }
}
