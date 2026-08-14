import type { AgentModelStatus, AgentRunStatus, AgentStatus, Message } from '@/types/agent';
import type { AgentRuntimeController } from '../controllers/agent-runtime-controller';

export const AgentRuntimeCommandType = {
  ADD_MESSAGE: 'ADD_AGENT_MESSAGE',
  MARK_RESULT_SUCCESSFUL: 'MARK_AGENT_RESULT_SUCCESSFUL',
  RESET_WORKFLOW: 'RESET_AGENT_WORKFLOW',
  SET_LOADING_PROGRESS: 'SET_AGENT_LOADING_PROGRESS',
  SET_MODEL_STATUS: 'SET_AGENT_MODEL_STATUS',
  SET_RUN_STATUS: 'SET_AGENT_RUN_STATUS',
  SET_STATUS: 'SET_AGENT_STATUS',
  UPDATE_MESSAGE: 'UPDATE_AGENT_MESSAGE',
} as const;

export type AgentRuntimeCommand =
  | { readonly type: typeof AgentRuntimeCommandType.ADD_MESSAGE; readonly message: Message }
  | { readonly type: typeof AgentRuntimeCommandType.MARK_RESULT_SUCCESSFUL }
  | { readonly type: typeof AgentRuntimeCommandType.RESET_WORKFLOW }
  | {
      readonly type: typeof AgentRuntimeCommandType.SET_LOADING_PROGRESS;
      readonly progress: number;
      readonly text: string;
    }
  | { readonly type: typeof AgentRuntimeCommandType.SET_MODEL_STATUS; readonly status: AgentModelStatus }
  | { readonly type: typeof AgentRuntimeCommandType.SET_RUN_STATUS; readonly status: AgentRunStatus }
  | { readonly type: typeof AgentRuntimeCommandType.SET_STATUS; readonly status: AgentStatus }
  | {
      readonly type: typeof AgentRuntimeCommandType.UPDATE_MESSAGE;
      readonly id: string;
      readonly content: string;
    };

export interface IAgentRuntimeCommandExecutor {
  readonly execute: (command: AgentRuntimeCommand) => void;
}

export class AgentRuntimeCommandExecutor implements IAgentRuntimeCommandExecutor {
  constructor(private readonly controller: AgentRuntimeController) {}

  execute(command: AgentRuntimeCommand): void {
    switch (command.type) {
      case AgentRuntimeCommandType.ADD_MESSAGE:
        this.controller.addMessage(command.message);
        return;
      case AgentRuntimeCommandType.MARK_RESULT_SUCCESSFUL:
        this.controller.markResultSuccessful();
        return;
      case AgentRuntimeCommandType.RESET_WORKFLOW:
        this.controller.resetWorkflow();
        return;
      case AgentRuntimeCommandType.SET_LOADING_PROGRESS:
        this.controller.setLoadingProgress(command.progress, command.text);
        return;
      case AgentRuntimeCommandType.SET_MODEL_STATUS:
        this.controller.setModelStatus(command.status);
        return;
      case AgentRuntimeCommandType.SET_RUN_STATUS:
        this.controller.setRunStatus(command.status);
        return;
      case AgentRuntimeCommandType.SET_STATUS:
        this.controller.setStatus(command.status);
        return;
      case AgentRuntimeCommandType.UPDATE_MESSAGE:
        this.controller.updateMessage(command.id, command.content);
    }
  }
}
