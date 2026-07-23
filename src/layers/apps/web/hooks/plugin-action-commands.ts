import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import type { PluginParameterValue } from '@/types/plugin-state';

interface PluginTrackTarget {
  trackId: string;
}

interface PluginInstanceTarget extends PluginTrackTarget {
  instanceId: string;
}

interface InstallPluginOptions extends PluginTrackTarget {
  manifestId: string;
}

interface SetPluginParameterOptions extends PluginInstanceTarget {
  parameterId: string;
  value: PluginParameterValue;
}

interface SetPluginEnabledOptions extends PluginInstanceTarget {
  isEnabled: boolean;
}

interface CommandExecutionOptions {
  executeCommand: (command: AudioCommand) => Promise<unknown>;
  notifyFailure: (message: string) => void;
}

interface PluginActionExecutionOptions extends CommandExecutionOptions {
  command: InstallPluginCommand | RemovePluginCommand | SetPluginEnabledCommand | SetPluginParameterCommand;
  failureMessage: string;
}

type InstallPluginCommand = Extract<AudioCommand, { type: typeof AudioCommandType.INSTALL_PLUGIN }>;
type RemovePluginCommand = Extract<AudioCommand, { type: typeof AudioCommandType.REMOVE_PLUGIN }>;
type SetPluginEnabledCommand = Extract<AudioCommand, { type: typeof AudioCommandType.SET_PLUGIN_ENABLED }>;
type SetPluginParameterCommand = Extract<AudioCommand, { type: typeof AudioCommandType.SET_PLUGIN_PARAMETER }>;
export type PluginActionResult = 'updated' | 'failed';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function executePluginAction({
  command,
  failureMessage,
  executeCommand,
  notifyFailure,
}: PluginActionExecutionOptions): Promise<PluginActionResult> {
  try {
    await executeCommand(command);
    return 'updated';
  } catch (error) {
    notifyFailure(`${failureMessage}: ${getErrorMessage(error)}`);
    return 'failed';
  }
}

export function createInstallPluginCommand({ trackId, manifestId }: InstallPluginOptions): InstallPluginCommand {
  return {
    type: AudioCommandType.INSTALL_PLUGIN,
    trackId,
    manifestId,
  };
}

export function createRemovePluginCommand({ trackId, instanceId }: PluginInstanceTarget): RemovePluginCommand {
  return {
    type: AudioCommandType.REMOVE_PLUGIN,
    trackId,
    instanceId,
  };
}

export function createSetPluginParameterCommand({
  trackId,
  instanceId,
  parameterId,
  value,
}: SetPluginParameterOptions): SetPluginParameterCommand {
  return {
    type: AudioCommandType.SET_PLUGIN_PARAMETER,
    trackId,
    instanceId,
    parameterId,
    value,
  };
}

export function createSetPluginEnabledCommand({
  trackId,
  instanceId,
  isEnabled,
}: SetPluginEnabledOptions): SetPluginEnabledCommand {
  return {
    type: AudioCommandType.SET_PLUGIN_ENABLED,
    trackId,
    instanceId,
    isEnabled,
  };
}

export function executePluginInstall({
  trackId,
  manifestId,
  executeCommand,
  notifyFailure,
}: InstallPluginOptions & CommandExecutionOptions): Promise<PluginActionResult> {
  return executePluginAction({
    command: createInstallPluginCommand({ trackId, manifestId }),
    failureMessage: 'Plugin을 설치하지 못했습니다',
    executeCommand,
    notifyFailure,
  });
}

export function executePluginRemoval({
  trackId,
  instanceId,
  executeCommand,
  notifyFailure,
}: PluginInstanceTarget & CommandExecutionOptions): Promise<PluginActionResult> {
  return executePluginAction({
    command: createRemovePluginCommand({ trackId, instanceId }),
    failureMessage: 'Plugin을 삭제하지 못했습니다',
    executeCommand,
    notifyFailure,
  });
}

export function executePluginParameterChange({
  trackId,
  instanceId,
  parameterId,
  value,
  executeCommand,
  notifyFailure,
}: SetPluginParameterOptions & CommandExecutionOptions): Promise<PluginActionResult> {
  return executePluginAction({
    command: createSetPluginParameterCommand({ trackId, instanceId, parameterId, value }),
    failureMessage: 'Plugin Parameter를 변경하지 못했습니다',
    executeCommand,
    notifyFailure,
  });
}

export function executePluginEnabledChange({
  trackId,
  instanceId,
  isEnabled,
  executeCommand,
  notifyFailure,
}: SetPluginEnabledOptions & CommandExecutionOptions): Promise<PluginActionResult> {
  return executePluginAction({
    command: createSetPluginEnabledCommand({ trackId, instanceId, isEnabled }),
    failureMessage: 'Plugin 활성화 상태를 변경하지 못했습니다',
    executeCommand,
    notifyFailure,
  });
}
