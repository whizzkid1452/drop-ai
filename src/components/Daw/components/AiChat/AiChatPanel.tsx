import { useState, useRef, useEffect } from 'react';
import { aiActionDispatcher } from '@/services/ai-action-dispatcher';
import { chatWithAI, webllmEngine, type ChatMessage } from '@/services/webllm-client';
import { useTrackStore } from '@/stores/useTrackStore';
import type { AIToolCall } from '@/types/ai-tools';
import { checkWebGPUSupport } from '@/utils/webgpu-check';
import * as styles from './AiChatPanel.css';

export function AiChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'WebLLM 엔진을 초기화하는 중입니다...',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initProgress, setInitProgress] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const tracks = useTrackStore(state => state.tracks);

  // 컴포넌트 마운트 시 WebLLM 엔진 초기화
  useEffect(() => {
    const initializeEngine = async () => {
      try {
        setIsInitializing(true);
        
        // WebGPU 지원 확인
        const webgpuSupport = await checkWebGPUSupport();
        if (!webgpuSupport.supported) {
          setMessages([
            {
              role: 'assistant',
              content: `❌ ${webgpuSupport.message}\n\n해결 방법:\n1. Chrome 113 이상 버전 사용\n2. chrome://flags에서 "WebGPU" 검색 후 활성화\n3. 브라우저 재시작`,
            },
          ]);
          setIsInitializing(false);
          return;
        }

        setInitProgress('WebGPU 확인 완료. 모델을 로딩하는 중입니다...');

        // 작은 모델부터 시도 (VRAM 부족 시 대비)
        const models = [
          'Llama-3-8B-Instruct-q4f16_1-MLC',
          'TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC',
        ];

        let initialized = false;
        for (const model of models) {
          try {
            setInitProgress(`모델 로딩 시도: ${model}`);
            await webllmEngine.initialize(model, report => {
              setInitProgress(report.text);
            });
            initialized = true;
            break;
          } catch (error) {
            console.warn(`${model} 로딩 실패, 다음 모델 시도:`, error);
            if (model === models[models.length - 1]) {
              throw error; // 마지막 모델도 실패하면 에러 throw
            }
          }
        }

        if (initialized) {
          setMessages([
            {
              role: 'assistant',
              content: '안녕하세요! 오디오 편집을 도와드리겠습니다. 무엇을 도와드릴까요?',
            },
          ]);
          setIsInitializing(false);
          setInitProgress('');
        }
      } catch (error) {
        console.error('WebLLM 초기화 실패:', error);
        setMessages([
          {
            role: 'assistant',
            content: `초기화 실패: ${error instanceof Error ? error.message : 'Unknown error'}\n\nWebGPU가 활성화되어 있는지 확인하세요. (chrome://flags에서 확인)`,
          },
        ]);
        setIsInitializing(false);
        setInitProgress('');
      }
    };

    initializeEngine();
  }, []);

  // 메시지가 추가될 때마다 스크롤을 맨 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * 현재 DAW 상태를 가져옵니다
   */
  const getCurrentDawState = () => {
    const tracksArray = Array.from(tracks.values());
    return {
      trackCount: tracks.size,
      tracks: tracksArray.map(track => ({
        id: track.id,
        volume: track.volume,
        pan: track.pan,
        status: track.status,
        regionCount: track.regions.length,
      })),
    };
  };

  /**
   * AI의 도구 호출을 실행합니다
   */
  const executeToolCalls = async (toolCalls: AIToolCall[]) => {
    const results: string[] = [];

    for (const toolCall of toolCalls) {
      try {
        const params = JSON.parse(toolCall.function.arguments);
        const result = await aiActionDispatcher.executeToolCall(
          toolCall.function.name as any,
          params
        );

        if (result.success) {
          results.push(`✅ ${result.message}`);
        } else {
          results.push(`❌ ${result.message}`);
        }
      } catch (error) {
        console.error('Tool execution error:', error);
        results.push(`❌ 도구 실행 중 오류: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results.join('\n');
  };

  /**
   * 메시지 전송 핸들러
   */
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
    };

    // 사용자 메시지 추가
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 현재 DAW 상태 가져오기
      const currentState = getCurrentDawState();

      // AI API 호출
      const response = await chatWithAI([...messages, userMessage], currentState);

      const assistantMessage = response.choices[0]?.message;

      if (!assistantMessage) {
        throw new Error('AI 응답이 없습니다');
      }

      // 도구 호출이 있는 경우
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // 도구 실행 결과를 메시지에 추가
        const toolResults = await executeToolCalls(assistantMessage.tool_calls);

        // AI 응답과 도구 실행 결과를 함께 표시
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: assistantMessage.content || '작업을 완료했습니다.',
            tool_calls: assistantMessage.tool_calls,
          },
          {
            role: 'assistant',
            content: toolResults,
          },
        ]);
      } else {
        // 일반 텍스트 응답
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: assistantMessage.content || '응답을 생성할 수 없습니다.',
          },
        ]);
      }
    } catch (error) {
      console.error('AI 요청 실패:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Enter 키로 전송 (Shift+Enter는 줄바꿈)
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>AI Assistant (WebLLM)</h3>
        <div className={styles.badge}>{tracks.size} tracks</div>
      </div>

      {isInitializing && (
        <div className={styles.initProgress}>
          <div className={styles.initProgressText}>{initProgress}</div>
          <div className={styles.initProgressBar}>
            <div className={styles.initProgressBarFill} />
          </div>
        </div>
      )}

      <div className={styles.messagesContainer}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`${styles.message} ${styles[msg.role]}`}
          >
            <div className={styles.messageRole}>
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className={styles.messageContent}>
              {msg.content}
              {msg.tool_calls && msg.tool_calls.length > 0 && (
                <div className={styles.toolCalls}>
                  <div className={styles.toolCallsLabel}>
                    실행된 도구: {msg.tool_calls.length}개
                  </div>
                  {msg.tool_calls.map((tool, i) => (
                    <div key={i} className={styles.toolCall}>
                      <code>{tool.function.name}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.messageRole}>🤖</div>
            <div className={styles.messageContent}>
              <div className={styles.loading}>생각 중...</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputContainer}>
        <textarea
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            isInitializing
              ? '엔진 초기화 중...'
              : 'AI에게 편집을 요청하세요... (예: 볼륨을 키워줘, 리버브 추가해줘)'
          }
          disabled={isLoading || isInitializing}
          rows={2}
        />
        <button
          className={styles.sendButton}
          onClick={handleSend}
          disabled={isLoading || isInitializing || !input.trim()}
        >
          {isInitializing ? '⏳' : isLoading ? '⏳' : '📤'}
        </button>
      </div>
    </div>
  );
}

