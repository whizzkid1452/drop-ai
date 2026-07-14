declare global {
  interface Window {
    gtag?: (command: string, targetId: string, config?: Record<string, unknown>) => void;
    dataLayer?: unknown[];
  }
}

type AnalyticsEventData = Record<string, string | number | boolean>;

export interface ChatMessageMetrics {
  messageLength: number;
  commandType?: string;
}

export interface AIResponseMetrics {
  responseLength: number;
  responseTimeMs: number;
  commandTypes: string[];
}

export interface AudioCommandMetrics {
  commandType: string;
  success: boolean;
}

export interface CommandExecutionResult {
  commandType: string;
  success: boolean;
}

export interface PromptSessionMetrics {
  userInputLength: number;
  aiResponseLength: number;
  commandTypes: string[];
  executionResults: CommandExecutionResult[];
  responseTimeMs: number;
}

interface ExecutionSummary {
  executionCommandTypes: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
}

function sendAnalyticsEvent(eventName: string, eventData: AnalyticsEventData): void {
  window.gtag?.('event', eventName, eventData);
}

function serializeCommandTypes(commandTypes: string[]): string {
  return commandTypes.length > 0 ? commandTypes.join(',') : 'none';
}

function summarizeExecutionResults(executionResults: CommandExecutionResult[]): ExecutionSummary {
  const successCount = executionResults.filter(result => result.success).length;
  const executionCount = executionResults.length;

  return {
    executionCommandTypes: serializeCommandTypes(executionResults.map(result => result.commandType)),
    executionCount,
    successCount,
    failureCount: executionCount - successCount,
    successRate: executionCount > 0 ? successCount / executionCount : 0,
  };
}

export function trackChatMessageSent(metrics: ChatMessageMetrics): void {
  // 대화 원문 대신 길이와 명령 유형만 전송해 임의 형식의 민감 정보 노출을 막는다.
  sendAnalyticsEvent('chat_message_sent', {
    message_length: metrics.messageLength,
    command_type: metrics.commandType ?? 'unknown',
  });
}

export function trackAIResponseReceived(metrics: AIResponseMetrics): void {
  sendAnalyticsEvent('ai_response_received', {
    response_length: metrics.responseLength,
    response_time_ms: metrics.responseTimeMs,
    parsed_commands: serializeCommandTypes(metrics.commandTypes),
    command_count: metrics.commandTypes.length,
  });
}

export function trackAudioCommandExecuted(metrics: AudioCommandMetrics): void {
  sendAnalyticsEvent('audio_command_executed', {
    command_type: metrics.commandType,
    success: metrics.success,
  });
}

export function trackPromptImprovementSession(metrics: PromptSessionMetrics): void {
  const executionSummary = summarizeExecutionResults(metrics.executionResults);

  sendAnalyticsEvent('prompt_improvement_session', {
    user_input_length: metrics.userInputLength,
    ai_response_length: metrics.aiResponseLength,
    parsed_commands: serializeCommandTypes(metrics.commandTypes),
    command_count: metrics.commandTypes.length,
    execution_command_types: executionSummary.executionCommandTypes,
    execution_count: executionSummary.executionCount,
    success_count: executionSummary.successCount,
    failure_count: executionSummary.failureCount,
    success_rate: executionSummary.successRate,
    response_time_ms: metrics.responseTimeMs,
  });
}
