import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFileDuration } from './get-audio-metadata';
import { convertFileToAudioFile } from './convert-file-to-audio-file';

vi.mock('./get-audio-metadata', () => ({
  getFileDuration: vi.fn(),
}));

describe('convertFileToAudioFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('재생용 Object URL 없이 AudioFile 메타데이터를 만든다', async () => {
    const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL');
    vi.mocked(getFileDuration).mockResolvedValue(3.5);

    const result = await convertFileToAudioFile(file);

    expect(result).toEqual({
      file,
      name: 'voice.wav',
      size: 5,
      formattedSize: '5.00 B',
      type: 'audio/wav',
      duration: 3.5,
      formattedDuration: '0:03',
      volume: 1,
    });
    expect(result).not.toHaveProperty('url');
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it('길이를 읽지 못해도 URL 없는 파일 메타데이터를 반환한다', async () => {
    const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL');
    vi.mocked(getFileDuration).mockRejectedValue(new Error('메타데이터 읽기 실패'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await convertFileToAudioFile(file);

    expect(result).toMatchObject({
      file,
      name: 'voice.wav',
      size: 5,
      type: 'audio/wav',
      duration: undefined,
      formattedDuration: undefined,
    });
    expect(result).not.toHaveProperty('url');
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});
