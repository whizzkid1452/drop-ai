import { CommandBatchExecutionError, type CommandBatchExecutionResult } from '@/layers/commands/command-executor';
import { parseAgentAudioCommandBatch, type AudioCommand } from '@/types/audioCommand.schema';
import { queryToLLM as queryToLLM } from './queryToLLM';
import type { MLCEngine } from '@/types/webllm.types';
import { trackAudioCommandExecuted } from '@/utils/analytics';

export interface AIResponseHandlerDependencies {
  executeMany: (commands: readonly AudioCommand[]) => Promise<CommandBatchExecutionResult>;
  engine: MLCEngine;
  tracks: {
    id: string;
    index: number;
    regions: { id: string; startTime: number; endTime: number }[];
  }[];
  userInput: string;
}

interface AgentCommandExecutionResult {
  commandType: string;
  success: boolean;
}

interface ExecuteAgentCommandsOptions {
  commands: readonly AudioCommand[];
  executeMany: AIResponseHandlerDependencies['executeMany'];
}

function recordCommandExecution(command: AudioCommand, success: boolean): AgentCommandExecutionResult {
  trackAudioCommandExecuted({ commandType: command.type, success });
  return { commandType: command.type, success };
}

async function executeAgentCommands({ commands, executeMany }: ExecuteAgentCommandsOptions) {
  try {
    const commandOutputs = await executeMany(commands);
    const executionResults = commands.map(command => recordCommandExecution(command, true));
    return { commandOutputs, executionResults };
  } catch (error) {
    if (!(error instanceof CommandBatchExecutionError)) {
      throw error;
    }

    const completedExecutionResults = commands
      .slice(0, error.failedIndex)
      .map(command => recordCommandExecution(command, true));
    const failedExecutionResult = recordCommandExecution(error.failedCommand, false);

    console.error('[aiResponseHandler] Command batch execution failed:', error.cause);
    return {
      commandOutputs: error.completedResults,
      executionResults: [...completedExecutionResults, failedExecutionResult],
    };
  }
}

/**
 * AI 응답을 처리하고 명령어를 실행하는 함수
 * @param deps 의존성 객체
 * @returns 처리 결과 (메시지 및 상태)
 */
export async function handleAIResponse(deps: AIResponseHandlerDependencies) {
  const { engine, tracks, userInput, executeMany } = deps;

  const { fullResponse, error: llmResponseError } = await queryToLLM({
    engine,
    tracks,
    userInput,
  });

  if (llmResponseError) {
    return {
      message: llmResponseError,
      status: 'error' as const,
      parsedCommands: null,
      executionResults: [],
      commandOutputs: [],
    };
  }

  if (!fullResponse) {
    return {
      message: 'No response from AI',
      status: 'error' as const,
      parsedCommands: null,
      executionResults: [],
      commandOutputs: [],
    };
  }

  const parseResult = parseAgentAudioCommandBatch({
    commandString: fullResponse,
  });
  const commands = parseResult.commands;
  const { error } = parseResult;

  if (commands && commands.length > 0) {
    const { commandOutputs, executionResults } = await executeAgentCommands({ commands, executeMany });

    return {
      message: fullResponse || '✅ Commands executed',
      status: 'idle' as const,
      parsedCommands: commands,
      executionResults,
      commandOutputs,
    };
  }

  return {
    message: fullResponse || 'no response',
    status: error ? 'error' : 'idle',
    parsedCommands: commands,
    executionResults: [],
    commandOutputs: [],
  } as const;
}
