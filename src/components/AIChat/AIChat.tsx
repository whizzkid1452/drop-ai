import { useEffect, useRef, useState } from "react";
import { useAIAgentStore } from "@/stores/useAIAgentStore";
import * as styles from "./AIChat.css";

/**
 * AI 채팅 컴포넌트
 * WebLLM을 사용하여 브라우저에서 AI와 대화하고 DAW를 제어합니다.
 */
export function AIChat() {
  const {
    isLoading,
    isModelLoaded,
    loadingProgress,
    loadingMessage,
    messages,
    isProcessing,
    error,
    initializeModel,
    sendMessage,
    clearError,
  } = useAIAgentStore();

  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지가 추가될 때마다 스크롤을 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const message = inputValue.trim();
    setInputValue("");
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <h2 className={styles.chatTitle}>🤖 AI 어시스턴트</h2>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className={styles.errorContainer}>
          <button className={styles.errorCloseButton} onClick={clearError}>
            ×
          </button>
          {error}
        </div>
      )}

      {/* 모델 로딩 중 */}
      {isLoading && (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingText}>
            AI 모델을 로드하는 중입니다...
            <br />
            <small>최초 실행 시 약 4-5GB의 모델을 다운로드합니다.</small>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <div className={styles.loadingText}>
            {loadingMessage || `${loadingProgress.toFixed(0)}%`}
          </div>
        </div>
      )}

      {/* 모델 미로드 상태 */}
      {!isLoading && !isModelLoaded && (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingText}>
            AI 어시스턴트를 시작하려면 모델을 로드해주세요.
            <br />
            <small>
              WebGPU를 지원하는 Chrome 113 이상이 필요합니다.
            </small>
          </div>
          <button className={styles.initButton} onClick={initializeModel}>
            AI 모델 로드하기
          </button>
        </div>
      )}

      {/* 채팅 메시지 */}
      {isModelLoaded && (
        <>
          <div className={styles.messagesContainer}>
            {messages.length === 0 && (
              <div className={styles.loadingText}>
                안녕하세요! 오디오 편집을 도와드리겠습니다.
                <br />
                예: "첫 번째 트랙 볼륨을 50%로 낮춰줘"
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.messageWrapper} ${
                  message.role === "user"
                    ? styles.messageUser
                    : styles.messageAssistant
                }`}
              >
                <div
                  className={`${styles.messageBubble} ${
                    message.role === "user"
                      ? styles.userBubble
                      : styles.assistantBubble
                  }`}
                >
                  {message.content}

                  {/* Tool Calls 표시 */}
                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className={styles.toolCallsContainer}>
                      <div style={{ marginBottom: "4px", color: "#aaa" }}>
                        🔧 실행된 작업:
                      </div>
                      {message.toolCalls.map((toolCall) => (
                        <div key={toolCall.id} className={styles.toolCallItem}>
                          {toolCall.name}(
                          {JSON.stringify(toolCall.arguments)})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.messageTimestamp}>
                  {formatTimestamp(message.timestamp)}
                </div>
              </div>
            ))}

            {/* 처리 중 표시 */}
            {isProcessing && (
              <div className={`${styles.messageWrapper} ${styles.messageAssistant}`}>
                <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                  생각하는 중...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className={styles.inputContainer}>
            <input
              type="text"
              className={styles.input}
              placeholder="메시지를 입력하세요..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isProcessing}
            />
            <button
              className={styles.sendButton}
              onClick={handleSendMessage}
              disabled={isProcessing || !inputValue.trim()}
            >
              전송
            </button>
          </div>
        </>
      )}
    </div>
  );
}

