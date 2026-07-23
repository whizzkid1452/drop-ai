import { describe, expect, it } from 'vitest';
import { createAgentUserPrompt } from './create-agent-user-prompt';

describe('createAgentUserPrompt', () => {
  it('MM:SS 입력을 초 단위로 치환한다', () => {
    const prompt = createAgentUserPrompt('export 0:00 to 1:30');

    expect(prompt).toBe('export 0 seconds to 90 seconds');
  });

  it('HH:MM:SS 입력을 초 단위로 치환한다', () => {
    const prompt = createAgentUserPrompt('move to 1:02:03');

    expect(prompt).toBe('move to 3723 seconds');
  });

  it('유효한 시간 표기가 없으면 입력을 변경하지 않는다', () => {
    const userInput = 'set pan to -50%';

    expect(createAgentUserPrompt(userInput)).toBe(userInput);
  });

  it('초가 60 이상인 표기는 시간으로 해석하지 않는다', () => {
    const userInput = 'export 1:60 to 2:00';
    const prompt = createAgentUserPrompt(userInput);

    expect(prompt).toBe('export 1:60 to 120 seconds');
  });
});
