/**
 * AI 에이전트 상태
 */
export interface AIAgentState {
  // 모델 로딩 상태
  isLoading: boolean;
  isModelLoaded: boolean;
  loadingProgress: number;
  loadingMessage: string;
  
  // 채팅 상태
  messages: ChatMessage[];
  isProcessing: boolean;
  error: string | null;
  
  // 액션
  initializeModel: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
}

/**
 * 채팅 메시지
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

/**
 * AI 도구 호출
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

/**
 * Function Calling 도구 정의
 */
export interface FunctionTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, FunctionParameter>;
      required?: string[];
    };
  };
}

export interface FunctionParameter {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
}

/**
 * DAW 액션 타입
 */
export type DAWAction =
  | { type: "SET_VOLUME"; trackId: string; volume: number }
  | { type: "TOGGLE_MUTE"; trackId: string }
  | { type: "TOGGLE_SOLO"; trackId: string }
  | { type: "SET_PLAYBACK_RATE"; trackId: string; rate: number }
  | { type: "TRIM_AUDIO"; trackId: string; startTime: number; endTime: number }
  | { type: "APPLY_FADE"; trackId: string; fadeType: "in" | "out"; duration: number }
  | { type: "DELETE_TRACK"; trackId: string }
  | { type: "EXPORT_PROJECT"; format: "wav" | "mp3" };

