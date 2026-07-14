/**
 * Google Analytics 유틸리티
 *
 * 개인정보 보호를 위해 사용자 입력의 전체 내용을 전송하지 않고,
 * 이벤트와 메타데이터만 추적합니다.
 */

declare global {
  interface Window {
    gtag?: (command: string, targetId: string, config?: Record<string, unknown>) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Google Analytics가 초기화되었는지 확인
 */
function isGAInitialized(): boolean {
  return typeof window.gtag === 'function';
}

/**
 * 사용자 채팅 메시지 전송 이벤트 추적
 *
 * @param messageLength - 메시지 길이
 * @param messageContent - 메시지 전체 내용 (프롬프트 개선용, 선택적)
 * @param commandType - 추출된 명령어 타입 (선택적)
 */
export function trackChatMessageSent(messageLength: number, messageContent?: string, commandType?: string): void {
  if (!isGAInitialized()) {
    console.warn('[Analytics] Google Analytics not initialized');
    return;
  }

  const eventData: Record<string, unknown> = {
    message_length: messageLength,
    command_type: commandType || 'unknown',
    timestamp: new Date().toISOString(),
  };

  // 프롬프트 개선을 위해 실제 메시지 내용도 전송 (개인정보 보호 정책에 따라 선택적)
  // GA Custom Dimensions에 저장하거나 별도 로깅 시스템으로 전송
  if (messageContent) {
    // 개인정보 제거: 이메일, 전화번호 등 민감 정보 마스킹
    const sanitizedContent = sanitizeUserMessage(messageContent);
    eventData.user_message = sanitizedContent;
  }

  window.gtag?.('event', 'chat_message_sent', eventData);
}

/**
 * 사용자 메시지에서 민감 정보를 제거하거나 마스킹
 *
 * @param message - 원본 메시지
 * @returns 정제된 메시지
 */
function sanitizeUserMessage(message: string): string {
  let sanitized = message;

  // 이메일 주소 마스킹
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

  // 전화번호 마스킹 (한국 형식 포함)
  sanitized = sanitized.replace(/\b(\d{2,3}[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/g, '[PHONE]');

  // URL 마스킹
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[URL]');

  return sanitized;
}

/**
 * AI 응답 수신 이벤트 추적
 *
 * @param responseLength - 응답 길이
 * @param responseTime - 응답 시간 (ms)
 * @param responseContent - AI 응답 전체 내용 (프롬프트 개선용, 선택적)
 * @param parsedCommands - 파싱된 명령어 배열 (선택적)
 */
export function trackAIResponseReceived(
  responseLength: number,
  responseTime: number,
  responseContent?: string,
  parsedCommands?: Array<{ type: string }>
): void {
  if (!isGAInitialized()) {
    return;
  }

  const eventData: Record<string, unknown> = {
    response_length: responseLength,
    response_time_ms: responseTime,
    timestamp: new Date().toISOString(),
  };

  // 프롬프트 개선을 위해 AI 응답과 파싱된 명령어도 전송
  if (responseContent) {
    eventData.ai_response = responseContent;
  }

  if (parsedCommands && parsedCommands.length > 0) {
    eventData.parsed_commands = parsedCommands.map(cmd => cmd.type).join(',');
    eventData.command_count = parsedCommands.length;
  }

  window.gtag?.('event', 'ai_response_received', eventData);
}

/**
 * 오디오 명령 실행 이벤트 추적
 *
 * @param commandType - 명령어 타입
 * @param success - 성공 여부
 * @param errorMessage - 에러 메시지 (실패 시, 선택적)
 */
export function trackAudioCommandExecuted(commandType: string, success: boolean, errorMessage?: string): void {
  if (!isGAInitialized()) {
    return;
  }

  const eventData: Record<string, unknown> = {
    command_type: commandType,
    success,
    timestamp: new Date().toISOString(),
  };

  // 실패 시 에러 메시지도 기록 (프롬프트 개선에 유용)
  if (!success && errorMessage) {
    eventData.error_message = errorMessage.substring(0, 200); // 길이 제한
  }

  window.gtag?.('event', 'audio_command_executed', eventData);
}

/**
 * 프롬프트 개선을 위한 전체 대화 세션 추적
 *
 * 이 함수는 사용자 입력, AI 응답, 실행 결과를 함께 추적하여
 * 프롬프트 개선에 필요한 데이터를 수집합니다.
 *
 * @param sessionData - 대화 세션 데이터
 */
export function trackPromptImprovementSession(sessionData: {
  userInput: string;
  aiResponse: string;
  parsedCommands?: Array<{ type: string }>;
  executionResults: Array<{
    commandType: string;
    success: boolean;
    errorMessage?: string;
  }>;
  responseTime: number;
}): void {
  if (!isGAInitialized()) {
    return;
  }

  const sanitizedUserInput = sanitizeUserMessage(sessionData.userInput);

  window.gtag?.('event', 'prompt_improvement_session', {
    user_input: sanitizedUserInput,
    ai_response: sessionData.aiResponse,
    parsed_commands: sessionData.parsedCommands?.map(c => c.type).join(',') || 'none',
    command_count: sessionData.parsedCommands?.length || 0,
    execution_results: sessionData.executionResults.map(r => ({
      command_type: r.commandType,
      success: r.success,
      error: r.errorMessage?.substring(0, 100),
    })),
    success_rate:
      sessionData.executionResults.length > 0
        ? sessionData.executionResults.filter(r => r.success).length / sessionData.executionResults.length
        : 0,
    response_time_ms: sessionData.responseTime,
    timestamp: new Date().toISOString(),
  });
}
