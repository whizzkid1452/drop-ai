import { describe, expect, it, vi } from 'vitest';
import type { MLCEngine } from '@/types/webllm.types';
import { queryToLLM } from './queryToLLM';

function createEngine(createCompletion: ReturnType<typeof vi.fn>): MLCEngine {
  return {
    chat: {
      completions: {
        create: createCompletion,
      },
    },
  } as unknown as MLCEngine;
}

describe('queryToLLM', () => {
  it('명령 묶음 JSON Schema로 배열 출력을 강제한다', async () => {
    const createCompletion = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await queryToLLM({
      engine: createEngine(createCompletion),
      plugins: [],
      tracks: [],
      userInput: 'play',
    });

    const request = createCompletion.mock.calls[0][0];
    expect(request.response_format.type).toBe('json_object');
    expect(JSON.parse(request.response_format.schema)).toMatchObject({ type: 'array' });
  });

  it('정규화한 시간 문맥을 모델에 전달한다', async () => {
    const createCompletion = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await queryToLLM({
      engine: createEngine(createCompletion),
      plugins: [],
      tracks: [],
      userInput: 'export 0:00 to 1:30',
    });

    const request = createCompletion.mock.calls[0][0];
    expect(request.messages[1]).toMatchObject({
      role: 'user',
      content: 'export 0 seconds to 90 seconds',
    });
  });
});
