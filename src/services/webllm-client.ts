/**
 * WebLLM Client
 * 브라우저에서 로컬로 Llama 모델을 실행하는 클라이언트
 */

import * as webllm from '@mlc-ai/web-llm';
import type { AIToolCall } from '@/types/ai-tools';
import { AI_TOOLS } from '@/types/ai-tools';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls?: AIToolCall[];
}

export interface ChatResponse {
  id: string;
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
}

export interface InitProgressReport {
  text: string;
  progress: number;
}

/**
 * WebLLM 엔진 관리 클래스
 */
class WebLLMEngine {
  private engine: webllm.MLCEngine | null = null;
  private isInitializing = false;
  private initProgressCallback?: (report: InitProgressReport) => void;

  /**
   * 엔진 초기화
   */
  async initialize(
    modelName: string = 'Llama-3-8B-Instruct-q4f16_1-MLC',
    progressCallback?: (report: InitProgressReport) => void
  ): Promise<void> {
    if (this.engine) {
      console.log('WebLLM 엔진이 이미 초기화되었습니다.');
      return;
    }

    if (this.isInitializing) {
      console.log('WebLLM 엔진 초기화 중...');
      return;
    }

    this.isInitializing = true;
    this.initProgressCallback = progressCallback;

    try {
      console.log(`모델 로딩 시작: ${modelName}`);

      this.engine = await webllm.CreateMLCEngine(modelName, {
        initProgressCallback: (report: webllm.InitProgressReport) => {
          const progressReport: InitProgressReport = {
            text: report.text,
            progress: report.progress,
          };
          this.initProgressCallback?.(progressReport);
          console.log(`초기화 진행: ${report.text} (${(report.progress * 100).toFixed(1)}%)`);
        },
      });

      console.log('WebLLM 엔진 초기화 완료');
    } catch (error) {
      console.error('WebLLM 엔진 초기화 실패:', error);
      this.isInitializing = false;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * 채팅 완료 생성
   */
  async chat(
    messages: ChatMessage[],
    currentState?: unknown
  ): Promise<ChatResponse> {
    if (!this.engine) {
      throw new Error('엔진이 초기화되지 않았습니다. 먼저 initialize()를 호출하세요.');
    }

    // 시스템 프롬프트 생성
    const systemPrompt = this.createSystemPrompt(currentState);

    // WebLLM 형식으로 메시지 변환
    const webllmMessages: Array<{ role: string; content: string }> = [];

    // 시스템 프롬프트 추가
    if (systemPrompt) {
      webllmMessages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // 사용자/어시스턴트 메시지 추가
    for (const msg of messages) {
      if (msg.role !== 'system') {
        webllmMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    try {
      // WebLLM은 Function Calling을 직접 지원하지 않으므로,
      // 프롬프트에 도구 정보를 포함하고 JSON 응답을 요청합니다.
      const response = await this.engine.chat.completions.create({
        messages: webllmMessages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      // WebLLM 응답을 표준 형식으로 변환
      const assistantMessage = response.choices[0]?.message;

      // Function calling을 시뮬레이션하기 위해 응답을 파싱
      const toolCalls = this.parseToolCalls(assistantMessage?.content || '');

      return {
        id: `webllm-${Date.now()}`,
        model: 'webllm',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: assistantMessage?.content || null,
              tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            },
            finish_reason: response.choices[0]?.finish_reason || 'stop',
          },
        ],
      };
    } catch (error) {
      console.error('WebLLM 채팅 오류:', error);
      throw error;
    }
  }

  /**
   * 시스템 프롬프트 생성
   */
  private createSystemPrompt(currentState?: unknown): string {
    const stateInfo = currentState
      ? `\n\n현재 프로젝트 상태:\n${JSON.stringify(currentState, null, 2)}`
      : '';

    return `당신은 Tone.js 기반 웹 DAW(Digital Audio Workstation)를 제어하는 전문 오디오 엔지니어 AI 에이전트입니다.
사용자의 자연어 요청을 해석하여 적절한 도구를 호출하여 오디오 편집 작업을 수행하세요.
${stateInfo}

중요 규칙:
1. 모든 오디오 편집은 비파괴적(Non-destructive)이어야 합니다.
2. 볼륨은 -60dB ~ 6dB 범위로 제한합니다.
3. 사용자가 구체적인 수치를 제시하지 않으면, 음악적으로 통용되는 합리적인 기본값을 사용하세요.
4. 실행 불가능한 요청에는 정중히 이유를 설명하고 대안을 제시하세요.

사용 가능한 도구:
${AI_TOOLS.map(
  tool =>
    `- ${tool.function.name}: ${tool.function.description}\n  파라미터: ${JSON.stringify(tool.function.parameters)}`
).join('\n')}

응답 형식:
도구를 호출해야 할 때는 다음 JSON 형식으로 응답하세요:
{
  "tool_calls": [
    {
      "function": {
        "name": "도구이름",
        "arguments": "{\\"param1\\": \\"value1\\"}"
      }
    }
  ]
}

일반 대화일 때는 자연스럽게 응답하세요.`;
  }

  /**
   * 응답에서 도구 호출 파싱
   * WebLLM은 Function Calling을 직접 지원하지 않으므로 JSON을 파싱합니다.
   */
  private parseToolCalls(content: string): AIToolCall[] {
    const toolCalls: AIToolCall[] = [];

    try {
      // JSON 블록 찾기 (```json ... ``` 또는 {...})
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);

        if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
          for (const toolCall of parsed.tool_calls) {
            if (toolCall.function) {
              toolCalls.push({
                id: `call-${Date.now()}-${Math.random()}`,
                type: 'function',
                function: {
                  name: toolCall.function.name,
                  arguments:
                    typeof toolCall.function.arguments === 'string'
                      ? toolCall.function.arguments
                      : JSON.stringify(toolCall.function.arguments),
                },
              });
            }
          }
        }
      }
    } catch (error) {
      // JSON 파싱 실패 시 무시 (일반 텍스트 응답으로 처리)
      console.log('도구 호출 파싱 실패 (일반 응답으로 처리):', error);
    }

    return toolCalls;
  }

  /**
   * 엔진 해제
   */
  async dispose(): Promise<void> {
    if (this.engine) {
      // WebLLM 엔진은 명시적인 dispose 메서드가 없을 수 있음
      this.engine = null;
      console.log('WebLLM 엔진 해제 완료');
    }
  }

  /**
   * 엔진 초기화 상태 확인
   */
  isReady(): boolean {
    return this.engine !== null;
  }

  /**
   * 초기화 중인지 확인
   */
  isInitializingState(): boolean {
    return this.isInitializing;
  }
}

// Singleton 인스턴스
export const webllmEngine = new WebLLMEngine();

/**
 * AI 채팅 API 호출 (WebLLM 버전)
 */
export async function chatWithAI(
  messages: ChatMessage[],
  currentState?: unknown
): Promise<ChatResponse> {
  return webllmEngine.chat(messages, currentState);
}

