import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandExecutor } from '@/layers/commands/command-executor';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { downloadWebAudioCommandResults, executeWebAudioCommand } from './execute-web-audio-command';

const mocks = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
}));

vi.mock('../components/Daw/components/ExportButton/utils/audioExport', () => ({
  downloadBlob: mocks.downloadBlob,
}));

describe('Web AudioCommand 결과 후처리', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('단건 명령의 기존 실행과 다운로드 동작을 유지한다', async () => {
    const exportedAudio = new Blob(['single'], { type: 'audio/wav' });
    const execute = vi.fn().mockResolvedValue(exportedAudio);
    const commandExecutor: Pick<CommandExecutor, 'execute'> = { execute };
    const command: AudioCommand = { type: AudioCommandType.EXPORT_AUDIO, filename: 'single' };

    await executeWebAudioCommand({ commandExecutor, command });

    expect(execute).toHaveBeenCalledWith(command);
    expect(mocks.downloadBlob).toHaveBeenCalledWith(exportedAudio, 'single.wav');
  });

  it('명령과 같은 위치의 Blob을 지정한 파일명으로 내려받는다', () => {
    const firstExport = new Blob(['first'], { type: 'audio/wav' });
    const secondExport = new Blob(['second'], { type: 'audio/wav' });
    const commands: AudioCommand[] = [
      { type: AudioCommandType.EXPORT_AUDIO, filename: 'first-mix' },
      { type: AudioCommandType.SET_TEMPO, tempo: 140 },
      { type: AudioCommandType.EXPORT_AUDIO },
    ];

    downloadWebAudioCommandResults({
      commands,
      results: [firstExport, undefined, secondExport],
    });

    expect(mocks.downloadBlob).toHaveBeenNthCalledWith(1, firstExport, 'first-mix.wav');
    expect(mocks.downloadBlob).toHaveBeenNthCalledWith(2, secondExport, 'export.wav');
  });

  it('중간 실패 전까지 반환된 Blob만 내려받는다', () => {
    const completedExport = new Blob(['completed'], { type: 'audio/wav' });
    const commands: AudioCommand[] = [
      { type: AudioCommandType.EXPORT_AUDIO, filename: 'completed' },
      { type: AudioCommandType.PAUSE },
      { type: AudioCommandType.EXPORT_AUDIO, filename: 'not-executed' },
    ];

    downloadWebAudioCommandResults({ commands, results: [completedExport] });

    expect(mocks.downloadBlob).toHaveBeenCalledOnce();
    expect(mocks.downloadBlob).toHaveBeenCalledWith(completedExport, 'completed.wav');
  });
});
