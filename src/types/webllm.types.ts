/**
 * WebLLM 타입 정의
 *
 * @mlc-ai/web-llm 패키지의 타입을 재정의하여
 * 프로젝트 전체에서 일관되게 사용합니다.
 */

import type { MLCEngineInterface } from '@mlc-ai/web-llm';

/**
 * WebLLM 엔진 인터페이스
 * MLCEngineInterface를 직접 export하여 사용
 */
export type MLCEngine = MLCEngineInterface;

/**
 * 채팅 완성 메시지
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 채팅 완성 요청 파라미터
 */
export interface ChatCompletionRequest {
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
}

/**
 * 채팅 완성 응답
 */
export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
      role: string;
    };
    finish_reason: string;
    index: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
