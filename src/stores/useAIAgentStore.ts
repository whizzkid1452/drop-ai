import { create } from "zustand";
import * as webllm from "@mlc-ai/web-llm";
import type { AIAgentState, ChatMessage, ToolCall } from "@/types/aiAgent";
import type { TrackStatus } from "@/types/track";
import { AI_TOOLS, SYSTEM_PROMPT } from "@/constants/aiTools";
import { useTrackStore } from "./useTrackStore";

/**
 * WebLLM 엔진 인스턴스 (싱글톤)
 */
let engineInstance: webllm.MLCEngineInterface | null = null;

/**
 * AI 에이전트 스토어
 * WebLLM을 사용하여 브라우저에서 Llama 모델을 실행하고 DAW를 제어합니다.
 */
export const useAIAgentStore = create<AIAgentState>()((set, get) => ({
  // 초기 상태
  isLoading: false,
  isModelLoaded: false,
  loadingProgress: 0,
  loadingMessage: "",
  messages: [],
  isProcessing: false,
  error: null,

  /**
   * WebLLM 모델 초기화
   * Llama-3.1-8B-Instruct 모델을 로드합니다 (약 4.7GB)
   */
  initializeModel: async () => {
    // 이미 로드된 경우 스킵
    if (engineInstance || get().isModelLoaded) {
      return;
    }

    set({ isLoading: true, loadingProgress: 0, error: null });

    try {
      // WebGPU 지원 확인
      if (!navigator.gpu) {
        throw new Error(
          "WebGPU를 지원하지 않는 브라우저입니다. Chrome 113 이상을 사용해주세요."
        );
      }

      // 모델 선택 - Function Calling 지원 모델
      const selectedModel = "Hermes-3-Llama-3.1-8B-q4f32_1-MLC";

      // 엔진 생성 및 모델 로드
      engineInstance = await webllm.CreateMLCEngine(selectedModel, {
        initProgressCallback: (report) => {
          set({
            loadingProgress: report.progress * 100,
            loadingMessage: report.text,
          });
        },
      });

      set({
        isLoading: false,
        isModelLoaded: true,
        loadingProgress: 100,
        loadingMessage: "모델 로드 완료!",
      });

      console.log("✅ WebLLM 모델 로드 완료");
    } catch (error) {
      console.error("❌ WebLLM 모델 로드 실패:", error);
      set({
        isLoading: false,
        isModelLoaded: false,
        error:
          error instanceof Error
            ? error.message
            : "모델을 로드하는 중 오류가 발생했습니다.",
      });
    }
  },

  /**
   * 사용자 메시지 전송 및 AI 응답 처리
   */
  sendMessage: async (content: string) => {
    if (!engineInstance) {
      set({ error: "모델이 로드되지 않았습니다. 먼저 초기화해주세요." });
      return;
    }

    if (get().isProcessing) {
      return;
    }

    set({ isProcessing: true, error: null });

    // 사용자 메시지 추가
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
    }));

    try {
      // 현재 프로젝트 상태를 컨텍스트로 추가
      const projectContext = getProjectContext();

      // 대화 히스토리 구성
      const messages: webllm.ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT + "\n\n" + projectContext },
        ...get().messages.map((msg) => ({
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
        })),
      ];

      // AI 응답 생성 (Function Calling 지원)
      const response = await engineInstance.chat.completions.create({
        messages,
        tools: AI_TOOLS as any,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 512,
      });

      const choice = response.choices[0];
      const assistantMessage = choice.message;

      // Tool Calls 처리
      let toolCalls: ToolCall[] | undefined;
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        toolCalls = assistantMessage.tool_calls.map((tc) => ({
          id: tc.id || `tool-${Date.now()}`,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        }));

        // 도구 실행
        await executeToolCalls(toolCalls);
      }

      // AI 응답 메시지 추가
      const aiMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: assistantMessage.content || "작업을 수행했습니다.",
        timestamp: Date.now(),
        toolCalls,
      };

      set((state) => ({
        messages: [...state.messages, aiMessage],
        isProcessing: false,
      }));
    } catch (error) {
      console.error("❌ AI 응답 생성 실패:", error);
      set({
        isProcessing: false,
        error:
          error instanceof Error
            ? error.message
            : "AI 응답을 생성하는 중 오류가 발생했습니다.",
      });
    }
  },

  /**
   * 메시지 기록 초기화
   */
  clearMessages: () => {
    set({ messages: [] });
  },

  /**
   * 에러 메시지 초기화
   */
  clearError: () => {
    set({ error: null });
  },
}));

/**
 * 현재 프로젝트 상태를 문자열로 변환
 * AI가 현재 상태를 이해할 수 있도록 컨텍스트 제공
 */
function getProjectContext(): string {
  const tracks = Array.from(useTrackStore.getState().getTracks().values());

  if (tracks.length === 0) {
    return "현재 프로젝트: 트랙 없음";
  }

  const trackInfo = tracks
    .map((track, index) => {
      const isMuted = track.status.includes("mute");
      const isSolo = track.status.includes("solo");
      const regionCount = track.regions.length;
      const firstRegion = track.regions[0];
      const audioFileName = firstRegion?.audioFile?.name || "알 수 없음";

      return `트랙 ${index + 1} (ID: ${track.id}):
  - 오디오 파일: ${audioFileName}
  - 리전 수: ${regionCount}
  - 볼륨: ${(track.volume * 100).toFixed(0)}%
  - 패닝: ${track.pan}
  - 음소거: ${isMuted ? "예" : "아니오"}
  - 솔로: ${isSolo ? "예" : "아니오"}`;
    })
    .join("\n\n");

  return `현재 프로젝트 상태:
총 트랙 수: ${tracks.length}

${trackInfo}`;
}

/**
 * AI가 호출한 도구들을 실제로 실행
 */
async function executeToolCalls(toolCalls: ToolCall[]): Promise<void> {
  const trackStore = useTrackStore.getState();

  for (const toolCall of toolCalls) {
    try {
      switch (toolCall.name) {
        case "set_track_volume": {
          const { trackId, volume } = toolCall.arguments;
          const track = trackStore.getTrack({ trackId });
          if (track) {
            // 볼륨 업데이트 (실제 WaveSurfer 인스턴스는 Track 컴포넌트에서 처리)
            const updatedTrack = {
              ...track,
              volume: Math.max(0, Math.min(1, volume)),
            };
            trackStore.addTrack({ track: updatedTrack });
            console.log(`✅ 트랙 ${trackId} 볼륨 설정: ${volume}`);
          }
          break;
        }

        case "toggle_track_mute": {
          const { trackId } = toolCall.arguments;
          const track = trackStore.getTrack({ trackId });
          if (track) {
            const isMuted = track.status.includes("mute");
            const newStatus: TrackStatus[] = isMuted
              ? track.status.filter((s) => s !== "mute")
              : [...track.status, "mute" as TrackStatus];
            
            const updatedTrack = {
              ...track,
              status: newStatus,
            };
            trackStore.addTrack({ track: updatedTrack });
            console.log(`✅ 트랙 ${trackId} 음소거 토글: ${!isMuted}`);
          }
          break;
        }

        case "toggle_track_solo": {
          const { trackId } = toolCall.arguments;
          const track = trackStore.getTrack({ trackId });
          if (track) {
            const isSolo = track.status.includes("solo");
            const newStatus: TrackStatus[] = isSolo
              ? track.status.filter((s) => s !== "solo")
              : [...track.status, "solo" as TrackStatus];
            
            const updatedTrack = {
              ...track,
              status: newStatus,
            };
            trackStore.addTrack({ track: updatedTrack });
            console.log(`✅ 트랙 ${trackId} 솔로 토글: ${!isSolo}`);
          }
          break;
        }

        case "set_playback_rate": {
          const { trackId, rate } = toolCall.arguments;
          const track = trackStore.getTrack({ trackId });
          if (track) {
            // playbackRate는 Track 타입에 없으므로 로그만 출력
            // 실제 구현은 Track 컴포넌트에서 WaveSurfer 인스턴스를 통해 처리
            console.log(`✅ 트랙 ${trackId} 재생 속도 설정 요청: ${rate}x`);
            console.warn("⚠️ playbackRate는 현재 Track 타입에 포함되지 않습니다.");
          }
          break;
        }

        case "delete_track": {
          const { trackId } = toolCall.arguments;
          trackStore.removeTrack({ trackId });
          console.log(`✅ 트랙 ${trackId} 삭제`);
          break;
        }

        case "get_project_info": {
          // 정보 조회는 별도 처리 불필요 (컨텍스트에 이미 포함)
          console.log("✅ 프로젝트 정보 조회");
          break;
        }

        default:
          console.warn(`⚠️ 알 수 없는 도구: ${toolCall.name}`);
      }
    } catch (error) {
      console.error(`❌ 도구 실행 실패 (${toolCall.name}):`, error);
    }
  }
}

