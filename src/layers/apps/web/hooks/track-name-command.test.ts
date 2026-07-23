import { describe, expect, it, vi } from 'vitest';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { createSetTrackNameCommand, executeTrackNameChange, normalizeTrackName } from './track-name-command';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';

describe('Track 이름 UI 명령 변환', () => {
  it('앞뒤 공백을 제거한 1자부터 255자까지의 이름만 허용한다', () => {
    expect(normalizeTrackName('  Lead Vocal  ')).toBe('Lead Vocal');
    expect(normalizeTrackName('a'.repeat(255))).toBe('a'.repeat(255));
    expect(normalizeTrackName('')).toBeNull();
    expect(normalizeTrackName('   ')).toBeNull();
    expect(normalizeTrackName('a'.repeat(256))).toBeNull();
  });

  it('Track 이름을 SET_TRACK_NAME 명령으로 변환한다', () => {
    expect(createSetTrackNameCommand({ trackId: TRACK_ID, name: '보컬' })).toEqual({
      type: AudioCommandType.SET_TRACK_NAME,
      trackId: TRACK_ID,
      name: '보컬',
    });
  });

  it('SET_TRACK_NAME 명령을 정확히 한 번 실행한다', async () => {
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined);

    const result = await executeTrackNameChange({
      trackId: TRACK_ID,
      name: '보컬',
      executeCommand,
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('updated');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(createSetTrackNameCommand({ trackId: TRACK_ID, name: '보컬' }));
  });

  it('실행 실패 원인을 사용자 메시지로 전달한다', async () => {
    const notifyFailure = vi.fn();

    const result = await executeTrackNameChange({
      trackId: TRACK_ID,
      name: '보컬',
      executeCommand: vi.fn().mockRejectedValue(new Error('저장 오류')),
      notifyFailure,
    });

    expect(result).toBe('failed');
    expect(notifyFailure).toHaveBeenCalledWith('Track 이름을 변경하지 못했습니다: 저장 오류');
  });
});
