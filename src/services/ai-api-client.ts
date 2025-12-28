/**
 * AI API Client
 * 백엔드 Express 서버와 통신하는 클라이언트
 */

import type { AIToolCall } from '@/types/ai-tools';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls?: AIToolCall[];
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: AIToolCall[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatRequest {
  messages: ChatMessage[];
  currentState?: unknown;
}

/**
 * AI 채팅 API 호출
 */
export async function chatWithAI(
  messages: ChatMessage[],
  currentState?: unknown
): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      currentState,
    } as ChatRequest),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

