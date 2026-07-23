import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CommandBatchExecutionResult,
  CommandExecutionResult,
  CommandExecutor,
} from '../../commands/command-executor';
import { AudioCommandType, type AudioCommand } from '../../shared/types/audioCommand.schema';
import { createCliCommands } from './index';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const SOURCE_ID = '33333333-3333-4333-8333-333333333333';
const PROJECT_ID = '44444444-4444-4444-8444-444444444444';
const PLUGIN_INSTANCE_ID = '55555555-5555-4555-8555-555555555555';
const PLUGIN_MANIFEST_ID = 'builtin.gain';

type CliCommandExecutor = Pick<CommandExecutor, 'execute' | 'executeMany'>;

const execute = vi.fn<(command: AudioCommand) => Promise<CommandExecutionResult>>().mockResolvedValue(undefined);
const executeMany = vi
  .fn<(commands: readonly AudioCommand[]) => Promise<CommandBatchExecutionResult>>()
  .mockResolvedValue([]);
const commandExecutor: CliCommandExecutor = { execute, executeMany };
const defaultState = { isPlaying: false, trackCount: 0, currentTime: 0, tempo: 120 };

describe('내부 CLI 명령 변환', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('play를 PLAY 명령으로 실행한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.play.fn();

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.PLAY });
  });

  it('pause를 PAUSE 명령으로 실행한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.pause.fn();

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.PAUSE });
  });

  it('stop을 STOP 명령으로 실행한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.stop.fn();

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.STOP });
  });

  it('undo를 UNDO 명령으로 실행한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.undo.fn();

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.UNDO });
    expect(result).toBe('Edit undone.');
  });

  it('redo를 REDO 명령으로 실행한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.redo.fn();

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.REDO });
    expect(result).toBe('Edit redone.');
  });

  it('save를 SAVE_PROJECT 명령으로 실행한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.save.fn();

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.SAVE_PROJECT });
    expect(result).toBe('Project saved.');
  });

  it('load-project의 Project ID를 LOAD_PROJECT 명령으로 변환한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands['load-project'].fn(PROJECT_ID);

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.LOAD_PROJECT, projectId: PROJECT_ID });
    expect(result).toBe(`Project ${PROJECT_ID} loaded.`);
  });

  it.each([undefined, 'project-1'])('load-project의 잘못된 Project ID %s를 실행 전에 거부한다', async projectId => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = projectId ? await commands['load-project'].fn(projectId) : await commands['load-project'].fn();

    expect(execute).not.toHaveBeenCalled();
    expect(result).toBe('Error: Usage: load-project <projectId>');
  });

  it('seek 인자를 SET_CURRENT_TIME 명령으로 변환한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.seek.fn('2.5');

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.SET_CURRENT_TIME, time: 2.5 });
  });

  it('tempo 인자를 SET_TEMPO 명령으로 변환한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.tempo.fn('140');

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.SET_TEMPO, tempo: 140 });
  });

  it('track add의 Track ID를 URL 없는 ADD_TRACK 명령으로 변환한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.track.fn('add', TRACK_ID);

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.ADD_TRACK, trackId: TRACK_ID });
  });

  it('track remove 인자를 REMOVE_TRACK 명령으로 변환한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.track.fn('remove', TRACK_ID);

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.REMOVE_TRACK, trackId: TRACK_ID });
  });

  it('plugin install 인자를 INSTALL_PLUGIN 명령으로 변환한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.plugin.fn('install', TRACK_ID, PLUGIN_MANIFEST_ID, PLUGIN_INSTANCE_ID);

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.INSTALL_PLUGIN,
      trackId: TRACK_ID,
      manifestId: PLUGIN_MANIFEST_ID,
      instanceId: PLUGIN_INSTANCE_ID,
    });
    expect(result).toBe(`Plugin ${PLUGIN_INSTANCE_ID} installed on track ${TRACK_ID}`);
  });

  it('plugin install에서 instanceId를 생략할 수 있다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.plugin.fn('install', TRACK_ID, PLUGIN_MANIFEST_ID);

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.INSTALL_PLUGIN,
      trackId: TRACK_ID,
      manifestId: PLUGIN_MANIFEST_ID,
    });
    expect(result).toBe(`Plugin ${PLUGIN_MANIFEST_ID} installed on track ${TRACK_ID}`);
  });

  it('plugin remove 인자를 REMOVE_PLUGIN 명령으로 변환한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.plugin.fn('remove', TRACK_ID, PLUGIN_INSTANCE_ID);

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.REMOVE_PLUGIN,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
    });
    expect(result).toBe(`Plugin ${PLUGIN_INSTANCE_ID} removed from track ${TRACK_ID}`);
  });

  it.each([
    ['number', '0.5', 0.5],
    ['boolean', 'true', true],
    ['boolean', 'false', false],
    ['string', 'soft', 'soft'],
  ] as const)('plugin set의 %s 값을 SET_PLUGIN_PARAMETER 명령으로 변환한다', async (valueType, rawValue, value) => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.plugin.fn('set', TRACK_ID, PLUGIN_INSTANCE_ID, 'gain', valueType, rawValue);

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.SET_PLUGIN_PARAMETER,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
      parameterId: 'gain',
      value,
    });
    expect(result).toBe(`Plugin ${PLUGIN_INSTANCE_ID} Parameter gain set to ${rawValue}`);
  });

  it.each([
    [['install', TRACK_ID], 'Error: Usage: plugin install <trackId> <manifestId> [instanceId]'],
    [['remove', TRACK_ID], 'Error: Usage: plugin remove <trackId> <instanceId>'],
    [
      ['set', TRACK_ID, PLUGIN_INSTANCE_ID, 'gain', 'boolean', 'yes'],
      'Error: Plugin Parameter value must match its declared CLI type.',
    ],
    [
      ['set', TRACK_ID, PLUGIN_INSTANCE_ID, 'gain', 'number', 'Infinity'],
      'Error: Plugin Parameter value must match its declared CLI type.',
    ],
    [
      ['set', TRACK_ID, PLUGIN_INSTANCE_ID, 'gain', 'object', '{}'],
      'Error: Plugin Parameter value type must be number, boolean, or string.',
    ],
  ] as const)('잘못된 plugin 인자 %j를 실행 전에 거부한다', async (args, expectedMessage) => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.plugin.fn(...args);

    expect(result).toBe(expectedMessage);
    expect(execute).not.toHaveBeenCalled();
  });

  it.each(['0', '0.4', '1'])('volume 경계값 %s를 SET_TRACK_VOLUME 명령으로 변환한다', async value => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.volume.fn(TRACK_ID, value);

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.SET_TRACK_VOLUME,
      trackId: TRACK_ID,
      volume: Number(value),
    });
  });

  it.each(['-1', '-0.25', '1'])('pan 경계값 %s를 SET_TRACK_PAN 명령으로 변환한다', async value => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.pan.fn(TRACK_ID, value);

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.SET_TRACK_PAN,
      trackId: TRACK_ID,
      pan: Number(value),
    });
  });

  it.each([
    ['mute', true],
    ['unmute', false],
  ] as const)('%s를 SET_TRACK_MUTE 명령으로 변환한다', async (name, muted) => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands[name].fn(TRACK_ID);

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.SET_TRACK_MUTE, trackId: TRACK_ID, muted });
  });

  it.each([
    ['solo', true],
    ['unsolo', false],
  ] as const)('%s를 SET_TRACK_SOLO 명령으로 변환한다', async (name, soloed) => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands[name].fn(TRACK_ID);

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.SET_TRACK_SOLO, trackId: TRACK_ID, soloed });
  });

  it('기존 URL 기반 region add를 실행하지 않는다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.region.fn('add', TRACK_ID, REGION_ID, 'https://example.com/audio.wav', '3', '5', '1');

    expect(result).toContain('region add-source');
    expect(execute).not.toHaveBeenCalled();
  });

  it('region add-source 인자를 sourceId 기반 LOAD_REGION 명령으로 변환한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.region.fn('add-source', TRACK_ID, REGION_ID, SOURCE_ID, '3', '5', '1');

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.LOAD_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      sourceId: SOURCE_ID,
      startTime: 3,
      duration: 5,
      startOffset: 1,
    });
  });

  it('region remove 인자를 UNLOAD_REGION 명령으로 변환한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.region.fn('remove', TRACK_ID, REGION_ID);

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.UNLOAD_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
    });
  });

  it('region split 인자를 SPLIT_REGION 명령으로 변환한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.region.fn('split', TRACK_ID, REGION_ID, '4');

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.SPLIT_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      splitTime: 4,
    });
  });

  it('region move 인자를 MOVE_REGION 명령으로 변환한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.region.fn('move', TRACK_ID, REGION_ID, '7');

    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.MOVE_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      newStartTime: 7,
    });
  });

  it('export all을 범위 해제 후 EXPORT_AUDIO 묶음으로 실행한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.export.fn('all');

    expect(executeMany).toHaveBeenCalledWith([
      { type: AudioCommandType.CLEAR_EXPORT_RANGE },
      { type: AudioCommandType.EXPORT_AUDIO },
    ]);
  });

  it('export range 인자를 범위 설정 후 EXPORT_AUDIO 묶음으로 실행한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    await commands.export.fn('range', '2', '8');

    expect(executeMany).toHaveBeenCalledWith([
      { type: AudioCommandType.SET_EXPORT_RANGE, startTime: 2, endTime: 8 },
      { type: AudioCommandType.EXPORT_AUDIO },
    ]);
  });

  it('숫자 뒤에 문자가 붙은 seek 인자를 거부한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.seek.fn('2seconds');

    expect(result).toBe('Error: Invalid time value.');
    expect(execute).not.toHaveBeenCalled();
  });

  it('0 이하 tempo를 거부한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.tempo.fn('0');

    expect(result).toBe('Error: Invalid BPM value.');
    expect(execute).not.toHaveBeenCalled();
  });

  it('길이가 0인 region add-source를 거부한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.region.fn('add-source', TRACK_ID, REGION_ID, SOURCE_ID, '0', '0');

    expect(result).toBe('Error: Region times must use finite numbers with duration greater than 0.');
    expect(execute).not.toHaveBeenCalled();
  });

  it('음수인 region move 위치를 거부한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.region.fn('move', TRACK_ID, REGION_ID, '-1');

    expect(result).toBe('Error: Invalid start time value.');
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ['8', '2'],
    ['2', '2'],
  ])('끝이 시작보다 작거나 같은 export range(%s, %s)를 거부한다', async (startTime, endTime) => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.export.fn('range', startTime, endTime);

    expect(result).toBe('Error: Export range must satisfy 0 <= start < end.');
    expect(executeMany).not.toHaveBeenCalled();
  });

  it('Track ID가 없는 track add를 거부한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.track.fn('add');

    expect(result).toBe('Error: Usage: track add <trackId>');
    expect(execute).not.toHaveBeenCalled();
  });

  it('명령 실행 오류를 성공 문구로 바꾸지 않고 전달한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);
    execute.mockRejectedValueOnce(new Error('재생 실패'));

    await expect(commands.play.fn()).rejects.toThrow('재생 실패');
  });

  it('help는 실제 인자 형식을 표시한다', async () => {
    const commands = createCliCommands(commandExecutor, defaultState);

    const result = await commands.help.fn();

    expect(result).toContain('track add <trackId>');
    expect(result).not.toContain('track add <trackId> <url>');
    expect(result).toContain('region add-source <trackId> <regionId> <sourceId>');
    expect(result).not.toContain('region add <trackId> <regionId> <url>');
    expect(result).toContain('region split <trackId> <regionId> <time>');
    expect(result).toContain('plugin install <trackId> <manifestId> [instanceId]');
    expect(result).toContain('plugin set <trackId> <instanceId> <parameterId> <number|boolean|string> <value>');
    expect(result).toContain('save');
    expect(result).not.toContain('--help');
  });

  it('status는 전달받은 조회 상태를 표시한다', async () => {
    const commands = createCliCommands(commandExecutor, {
      isPlaying: true,
      trackCount: 3,
      currentTime: 5.5,
      tempo: 140,
    });

    const result = await commands.status.fn();

    expect(result).toContain('Playing');
    expect(result).toContain('Tracks: 3');
  });
});
