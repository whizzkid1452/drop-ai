import { describe, expect, it, vi } from 'vitest';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import {
  createInstallPluginCommand,
  createMovePluginCommand,
  createRemovePluginCommand,
  createSetPluginEnabledCommand,
  createSetPluginParameterCommand,
  executePluginEnabledChange,
  executePluginInstall,
  executePluginMove,
  executePluginParameterChange,
  executePluginRemoval,
} from './plugin-action-commands';

const trackId = '11111111-1111-4111-8111-111111111111';
const instanceId = '22222222-2222-4222-8222-222222222222';

describe('Plugin UI 명령 변환', () => {
  it('설치 요청을 INSTALL_PLUGIN 명령으로 변환한다', () => {
    expect(createInstallPluginCommand({ trackId, manifestId: 'builtin.gain' })).toEqual({
      type: AudioCommandType.INSTALL_PLUGIN,
      trackId,
      manifestId: 'builtin.gain',
    });
  });

  it('삭제 요청을 REMOVE_PLUGIN 명령으로 변환한다', () => {
    expect(createRemovePluginCommand({ trackId, instanceId })).toEqual({
      type: AudioCommandType.REMOVE_PLUGIN,
      trackId,
      instanceId,
    });
  });

  it('순서 변경 요청을 MOVE_PLUGIN 명령으로 변환한다', () => {
    expect(createMovePluginCommand({ trackId, instanceId, targetIndex: 1 })).toEqual({
      type: AudioCommandType.MOVE_PLUGIN,
      trackId,
      instanceId,
      targetIndex: 1,
    });
  });

  it('파라미터 요청을 SET_PLUGIN_PARAMETER 명령으로 변환한다', () => {
    expect(createSetPluginParameterCommand({ trackId, instanceId, parameterId: 'gain', value: 1.25 })).toEqual({
      type: AudioCommandType.SET_PLUGIN_PARAMETER,
      trackId,
      instanceId,
      parameterId: 'gain',
      value: 1.25,
    });
  });

  it('활성화 요청을 SET_PLUGIN_ENABLED 명령으로 변환한다', () => {
    expect(createSetPluginEnabledCommand({ trackId, instanceId, isEnabled: false })).toEqual({
      type: AudioCommandType.SET_PLUGIN_ENABLED,
      trackId,
      instanceId,
      isEnabled: false,
    });
  });

  it('설치 명령을 정확히 한 번 실행한다', async () => {
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined);

    const result = await executePluginInstall({
      trackId,
      manifestId: 'builtin.gain',
      executeCommand,
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('updated');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(createInstallPluginCommand({ trackId, manifestId: 'builtin.gain' }));
  });

  it('삭제 명령을 정확히 한 번 실행한다', async () => {
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined);

    const result = await executePluginRemoval({
      trackId,
      instanceId,
      executeCommand,
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('updated');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(createRemovePluginCommand({ trackId, instanceId }));
  });

  it('순서 변경 명령을 정확히 한 번 실행한다', async () => {
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined);

    const result = await executePluginMove({
      trackId,
      instanceId,
      targetIndex: 1,
      executeCommand,
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('updated');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(createMovePluginCommand({ trackId, instanceId, targetIndex: 1 }));
  });

  it('파라미터 명령을 정확히 한 번 실행한다', async () => {
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined);

    const result = await executePluginParameterChange({
      trackId,
      instanceId,
      parameterId: 'gain',
      value: 0.75,
      executeCommand,
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('updated');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(
      createSetPluginParameterCommand({ trackId, instanceId, parameterId: 'gain', value: 0.75 })
    );
  });

  it('활성화 명령을 정확히 한 번 실행한다', async () => {
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined);

    const result = await executePluginEnabledChange({
      trackId,
      instanceId,
      isEnabled: false,
      executeCommand,
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('updated');
    expect(executeCommand).toHaveBeenCalledWith(
      createSetPluginEnabledCommand({ trackId, instanceId, isEnabled: false })
    );
  });

  it('실패한 작업과 원인을 사용자 메시지로 전달한다', async () => {
    const notifyFailure = vi.fn();

    const result = await executePluginParameterChange({
      trackId,
      instanceId,
      parameterId: 'gain',
      value: 2,
      executeCommand: vi.fn().mockRejectedValue(new Error('범위 오류')),
      notifyFailure,
    });

    expect(result).toBe('failed');
    expect(notifyFailure).toHaveBeenCalledWith('Plugin Parameter를 변경하지 못했습니다: 범위 오류');
  });
});
