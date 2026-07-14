import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  trackAIResponseReceived,
  trackAudioCommandExecuted,
  trackChatMessageSent,
  trackPromptImprovementSession,
} from './analytics';

const sensitiveText = '내 계좌 비밀번호는 secret-1234';

describe('Analytics 페이로드 최소화', () => {
  const gtag = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', { gtag });
  });

  it('사용자 메시지 원문을 전송하지 않는다', () => {
    trackChatMessageSent({ messageLength: sensitiveText.length });

    const payload = gtag.mock.calls[0][2];
    expect(payload).toEqual({ message_length: sensitiveText.length, command_type: 'unknown' });
    expect(JSON.stringify(payload)).not.toContain(sensitiveText);
  });

  it('AI 응답 원문을 전송하지 않는다', () => {
    trackAIResponseReceived({
      responseLength: sensitiveText.length,
      responseTimeMs: 100,
      commandTypes: ['PLAY'],
    });

    const payload = gtag.mock.calls[0][2];
    expect(payload).toEqual({
      response_length: sensitiveText.length,
      response_time_ms: 100,
      parsed_commands: 'PLAY',
      command_count: 1,
    });
    expect(JSON.stringify(payload)).not.toContain(sensitiveText);
  });

  it('프롬프트 세션에 대화와 오류 원문을 포함하지 않는다', () => {
    trackPromptImprovementSession({
      userInputLength: sensitiveText.length,
      aiResponseLength: sensitiveText.length,
      commandTypes: ['PLAY'],
      executionResults: [{ commandType: 'PLAY', success: false }],
      responseTimeMs: 100,
    });

    const payload = gtag.mock.calls[0][2];
    expect(payload).toEqual({
      user_input_length: sensitiveText.length,
      ai_response_length: sensitiveText.length,
      parsed_commands: 'PLAY',
      command_count: 1,
      execution_command_types: 'PLAY',
      execution_count: 1,
      success_count: 0,
      failure_count: 1,
      success_rate: 0,
      response_time_ms: 100,
    });
    expect(JSON.stringify(payload)).not.toContain(sensitiveText);
  });

  it('명령 실행 오류 원문을 전송하지 않는다', () => {
    trackAudioCommandExecuted({ commandType: 'PLAY', success: false });

    const payload = gtag.mock.calls[0][2];
    expect(payload).toEqual({ command_type: 'PLAY', success: false });
    expect(JSON.stringify(payload)).not.toContain(sensitiveText);
  });
});
