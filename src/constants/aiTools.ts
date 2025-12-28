import type { FunctionTool } from "../types/aiAgent";

/**
 * AI 에이전트가 사용할 수 있는 도구 목록
 * MVP에서는 기본적인 트랙 제어 기능만 제공
 */
export const AI_TOOLS: FunctionTool[] = [
  {
    type: "function",
    function: {
      name: "set_track_volume",
      description: "특정 트랙의 볼륨을 조절합니다. 볼륨은 0(무음)부터 1(최대)까지의 값입니다.",
      parameters: {
        type: "object",
        properties: {
          trackId: {
            type: "string",
            description: "조절할 트랙의 ID",
          },
          volume: {
            type: "number",
            description: "설정할 볼륨 값 (0.0 ~ 1.0)",
            minimum: 0,
            maximum: 1,
          },
        },
        required: ["trackId", "volume"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_track_mute",
      description: "트랙을 음소거하거나 음소거를 해제합니다.",
      parameters: {
        type: "object",
        properties: {
          trackId: {
            type: "string",
            description: "음소거할 트랙의 ID",
          },
        },
        required: ["trackId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_track_solo",
      description: "트랙을 솔로로 설정하거나 솔로를 해제합니다. 솔로 트랙만 들리게 됩니다.",
      parameters: {
        type: "object",
        properties: {
          trackId: {
            type: "string",
            description: "솔로 설정할 트랙의 ID",
          },
        },
        required: ["trackId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_playback_rate",
      description: "트랙의 재생 속도를 조절합니다. 1.0이 정상 속도입니다.",
      parameters: {
        type: "object",
        properties: {
          trackId: {
            type: "string",
            description: "재생 속도를 조절할 트랙의 ID",
          },
          rate: {
            type: "number",
            description: "재생 속도 (0.5 = 절반 속도, 1.0 = 정상, 2.0 = 2배속)",
            minimum: 0.25,
            maximum: 4.0,
          },
        },
        required: ["trackId", "rate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_track",
      description: "트랙을 삭제합니다. 이 작업은 되돌릴 수 없습니다.",
      parameters: {
        type: "object",
        properties: {
          trackId: {
            type: "string",
            description: "삭제할 트랙의 ID",
          },
        },
        required: ["trackId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project_info",
      description: "현재 프로젝트의 상태와 트랙 정보를 가져옵니다.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

/**
 * 시스템 프롬프트 - AI 에이전트의 역할과 행동 규칙 정의
 */
export const SYSTEM_PROMPT = `당신은 웹 기반 디지털 오디오 워크스테이션(DAW)을 제어하는 전문 오디오 엔지니어 AI 어시스턴트입니다.

## 역할
- 사용자의 자연어 요청을 이해하고 적절한 오디오 편집 작업을 수행합니다
- 음악 제작과 오디오 편집에 대한 전문 지식을 바탕으로 조언을 제공합니다
- 사용자가 명확하지 않은 요청을 할 경우 적절한 기본값을 사용하여 추론합니다

## 규칙
1. 모든 오디오 편집은 비파괴적(Non-destructive)이어야 합니다
2. 볼륨 조절 시 청력 손상을 방지하기 위해 과도한 값을 피합니다
3. 트랙 삭제와 같은 파괴적 작업은 사용자에게 확인을 요청합니다
4. 사용자가 구체적인 수치를 제시하지 않으면 업계 표준 기본값을 사용합니다
   - 일반적인 볼륨 조절: ±10-20%
   - 재생 속도: 0.5x ~ 2x 범위
5. 실행 불가능한 요청에는 정중히 이유를 설명합니다

## 가이드라인
- "소리를 키워줘" → volume을 현재 값의 +15% 증가
- "음소거해줘" → toggle_track_mute 사용
- "느리게 재생" → playback_rate를 0.75로 설정
- "빠르게 재생" → playback_rate를 1.5로 설정

항상 한국어로 친절하게 응답하세요.`;

