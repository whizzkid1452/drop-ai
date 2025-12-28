/**
 * AI 에이전트가 호출할 수 있는 도구(Tool)들의 스키마 정의
 * OpenAI Function Calling API 형식을 따릅니다.
 */

/**
 * OpenAI Function Calling을 위한 도구 스키마
 */
export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'set_volume',
      description:
        '트랙의 볼륨을 조절합니다. dB 단위로 설정하며, -60dB부터 6dB까지 안전 범위 내에서 조절됩니다.',
      parameters: {
        type: 'object',
        properties: {
          trackId: {
            type: 'string',
            description: '볼륨을 조절할 대상 트랙의 ID',
          },
          volume: {
            type: 'number',
            description: '설정할 볼륨 값 (dB 단위, -60 ~ 6 범위)',
          },
        },
        required: ['trackId', 'volume'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trim_audio',
      description:
        '오디오의 특정 구간만 남기고 나머지를 제거합니다. 비파괴적 편집 방식으로 원본은 유지됩니다.',
      parameters: {
        type: 'object',
        properties: {
          trackId: {
            type: 'string',
            description: '편집할 트랙의 ID',
          },
          startTime: {
            type: 'number',
            description: '남길 구간의 시작 시간 (초 단위)',
          },
          endTime: {
            type: 'number',
            description: '남길 구간의 끝 시간 (초 단위)',
          },
        },
        required: ['trackId', 'startTime', 'endTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_reverb',
      description:
        '리버브 효과를 적용하여 오디오에 공간감과 잔향을 추가합니다. 홀, 스튜디오 같은 공간감을 시뮬레이션합니다.',
      parameters: {
        type: 'object',
        properties: {
          trackId: {
            type: 'string',
            description: '이펙트를 적용할 트랙의 ID',
          },
          decay: {
            type: 'number',
            description:
              '잔향 시간 (초 단위, 0.1~10 범위). 기본값은 2.0초입니다.',
          },
          wet: {
            type: 'number',
            description:
              '이펙트 믹스 비율 (0~1). 0은 원본만, 1은 이펙트만. 기본값 0.3',
          },
        },
        required: ['trackId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_filter',
      description:
        '주파수 필터를 적용하여 특정 주파수 대역을 강조하거나 제거합니다. 소리를 밝게 하거나 어둡게 만들 수 있습니다.',
      parameters: {
        type: 'object',
        properties: {
          trackId: {
            type: 'string',
            description: '필터를 적용할 트랙의 ID',
          },
          type: {
            type: 'string',
            enum: ['lowpass', 'highpass', 'bandpass'],
            description:
              'lowpass: 저음 통과(고음 제거), highpass: 고음 통과(저음 제거), bandpass: 특정 대역만 통과',
          },
          frequency: {
            type: 'number',
            description:
              '컷오프 주파수 (Hz 단위, 20~20000). 기본값은 1000Hz입니다.',
          },
        },
        required: ['trackId', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_eq',
      description:
        '이퀄라이저를 적용하여 특정 주파수 대역의 음량을 조절합니다. 저음, 중음, 고음을 독립적으로 제어할 수 있습니다.',
      parameters: {
        type: 'object',
        properties: {
          trackId: {
            type: 'string',
            description: 'EQ를 적용할 트랙의 ID',
          },
          low: {
            type: 'number',
            description:
              '저음역 게인 (dB, -12 ~ 12 범위). 기본값 0dB (변화 없음)',
          },
          mid: {
            type: 'number',
            description:
              '중음역 게인 (dB, -12 ~ 12 범위). 기본값 0dB (변화 없음)',
          },
          high: {
            type: 'number',
            description:
              '고음역 게인 (dB, -12 ~ 12 범위). 기본값 0dB (변화 없음)',
          },
        },
        required: ['trackId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fade_in',
      description: '오디오의 시작 부분을 점진적으로 페이드 인합니다.',
      parameters: {
        type: 'object',
        properties: {
          trackId: {
            type: 'string',
            description: '페이드 인을 적용할 트랙의 ID',
          },
          duration: {
            type: 'number',
            description:
              '페이드 인 지속 시간 (초 단위, 0.1~10). 기본값 2.0초',
          },
        },
        required: ['trackId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fade_out',
      description: '오디오의 끝 부분을 점진적으로 페이드 아웃합니다.',
      parameters: {
        type: 'object',
        properties: {
          trackId: {
            type: 'string',
            description: '페이드 아웃을 적용할 트랙의 ID',
          },
          duration: {
            type: 'number',
            description:
              '페이드 아웃 지속 시간 (초 단위, 0.1~10). 기본값 2.0초',
          },
        },
        required: ['trackId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_track_info',
      description:
        '특정 트랙의 상세 정보를 조회합니다. 현재 볼륨, 적용된 이펙트, 길이 등을 확인할 수 있습니다.',
      parameters: {
        type: 'object',
        properties: {
          trackId: {
            type: 'string',
            description: '정보를 조회할 트랙의 ID',
          },
        },
        required: ['trackId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mute_track',
      description: '트랙을 음소거하거나 음소거를 해제합니다.',
      parameters: {
        type: 'object',
        properties: {
          trackId: {
            type: 'string',
            description: '음소거할 트랙의 ID',
          },
          mute: {
            type: 'boolean',
            description: 'true: 음소거, false: 음소거 해제',
          },
        },
        required: ['trackId', 'mute'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'solo_track',
      description:
        '특정 트랙만 재생하고 나머지 트랙을 음소거합니다 (솔로 모드).',
      parameters: {
        type: 'object',
        properties: {
          trackId: {
            type: 'string',
            description: '솔로로 들을 트랙의 ID',
          },
          solo: {
            type: 'boolean',
            description: 'true: 솔로 활성화, false: 솔로 해제',
          },
        },
        required: ['trackId', 'solo'],
      },
    },
  },
] as const;

/**
 * 도구 실행 결과 타입
 */
export type ToolCallResult = {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
};

/**
 * 각 도구의 파라미터 타입 정의
 */
export type SetVolumeParams = {
  trackId: string;
  volume: number;
};

export type TrimAudioParams = {
  trackId: string;
  startTime: number;
  endTime: number;
};

export type ApplyReverbParams = {
  trackId: string;
  decay?: number;
  wet?: number;
};

export type ApplyFilterParams = {
  trackId: string;
  type: 'lowpass' | 'highpass' | 'bandpass';
  frequency?: number;
};

export type ApplyEqParams = {
  trackId: string;
  low?: number;
  mid?: number;
  high?: number;
};

export type FadeInParams = {
  trackId: string;
  duration?: number;
};

export type FadeOutParams = {
  trackId: string;
  duration?: number;
};

export type GetTrackInfoParams = {
  trackId: string;
};

export type MuteTrackParams = {
  trackId: string;
  mute: boolean;
};

export type SoloTrackParams = {
  trackId: string;
  solo: boolean;
};

/**
 * 모든 도구 파라미터의 유니온 타입
 */
export type ToolParams =
  | SetVolumeParams
  | TrimAudioParams
  | ApplyReverbParams
  | ApplyFilterParams
  | ApplyEqParams
  | FadeInParams
  | FadeOutParams
  | GetTrackInfoParams
  | MuteTrackParams
  | SoloTrackParams;

/**
 * 도구 이름 타입
 */
export type ToolName =
  | 'set_volume'
  | 'trim_audio'
  | 'apply_reverb'
  | 'apply_filter'
  | 'apply_eq'
  | 'fade_in'
  | 'fade_out'
  | 'get_track_info'
  | 'mute_track'
  | 'solo_track';

/**
 * AI 도구 호출 데이터 구조
 */
export type AIToolCall = {
  id: string;
  type: 'function';
  function: {
    name: ToolName;
    arguments: string; // JSON string
  };
};

/**
 * 안전 범위 상수
 */
export const SAFE_RANGES = {
  VOLUME: { min: -60, max: 6 } as const,
  EQ: { min: -12, max: 12 } as const,
  FREQUENCY: { min: 20, max: 20000 } as const,
  WET: { min: 0, max: 1 } as const,
  REVERB_DECAY: { min: 0.1, max: 10 } as const,
  FADE_DURATION: { min: 0.1, max: 10 } as const,
} as const;

/**
 * 값을 안전 범위 내로 클램핑하는 유틸리티 함수
 */
export function clampValue(
  value: number,
  range: { min: number; max: number }
): number {
  return Math.max(range.min, Math.min(range.max, value));
}

