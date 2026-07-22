import { describe, expect, it } from 'vitest';
import { AgentAudioCommandBatchSchema, AudioCommandType } from '@/types/audioCommand.schema';
import {
  AGENT_PROJECT_CONTEXT_MAX_CHARACTERS,
  AGENT_PROMPT_EXAMPLES,
  getSystemPrompt,
  type AgentPromptTrack,
} from './getSystemPrompt';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const tracks: AgentPromptTrack[] = [
  {
    id: TRACK_ID,
    index: 0,
    regions: [
      {
        id: REGION_ID,
        startTime: 1,
        endTime: 4.5,
        sourceStartTime: 2,
        duration: 3.5,
        hasAudioSource: true,
      },
    ],
  },
];

describe('Agent 시스템 Prompt', () => {
  it('현재 AudioCommand 18개를 모두 설명한다', () => {
    const prompt = getSystemPrompt({ tracks });

    for (const commandType of Object.values(AudioCommandType)) {
      expect(prompt).toContain(`- ${commandType}:`);
    }
  });

  it('트랙과 Region의 실제 식별자, 시간, 소스 사용 가능 여부를 전달한다', () => {
    const prompt = getSystemPrompt({ tracks });

    expect(prompt).toContain(`Track 1: id=${TRACK_ID}`);
    expect(prompt).toContain(
      `Region 1: id=${REGION_ID}, startTime=1, endTime=4.5, sourceStartTime=2, duration=3.5, source=available`
    );
  });

  it('Region 소스가 없으면 사용할 수 없다고 표시한다', () => {
    const prompt = getSystemPrompt({
      tracks: [
        {
          ...tracks[0],
          regions: [{ ...tracks[0].regions[0], hasAudioSource: false }],
        },
      ],
    });

    expect(prompt).toContain('source=unavailable');
  });

  it('모든 예시 출력이 엄격한 Agent 명령 Schema를 통과한다', () => {
    for (const example of AGENT_PROMPT_EXAMPLES) {
      expect(AgentAudioCommandBatchSchema.safeParse(example.commands).success).toBe(true);
    }

    const renderedExamples = getSystemPrompt({ tracks }).split('# 예시\n')[1].trim().split('\n');
    for (const renderedExample of renderedExamples) {
      const commandJson = renderedExample.split(' → ')[1];
      expect(AgentAudioCommandBatchSchema.safeParse(JSON.parse(commandJson)).success).toBe(true);
    }
  });

  it('첫 Region 복제 예시는 원본 소스 범위를 유지한다', () => {
    const prompt = getSystemPrompt({ tracks });

    expect(prompt).toContain('"startOffset":2,"duration":3.5');
  });

  it('한국어와 영어 요청 예시를 모두 제공한다', () => {
    expect(AGENT_PROMPT_EXAMPLES.some(example => /[가-힣]/.test(example.request))).toBe(true);
    expect(AGENT_PROMPT_EXAMPLES.some(example => /^[A-Za-z0-9 .!?-]+$/.test(example.request))).toBe(true);
  });

  it('출력 형식과 식별자, URL 안전 규칙을 명시한다', () => {
    const prompt = getSystemPrompt({ tracks });

    expect(prompt).toContain('JSON 배열만 반환');
    expect(prompt).toContain('기존 Track과 Region의 ID는 위 목록의 값만 사용');
    expect(prompt).toContain('URL을 추측하거나 만들어내지 않음');
    expect(prompt).toContain('정보가 부족하면 []');
    expect(prompt).toContain('ADD_TRACK은 현재 Agent에서 사용하지 않는다');
    expect(prompt).toContain('regionId와 url은 생략');
  });

  it('모든 시간 필드의 음수 금지 범위를 명시한다', () => {
    const prompt = getSystemPrompt({ tracks });

    expect(prompt).toContain('"startTime":<seconds >= 0>');
    expect(prompt).toContain('"startOffset":<seconds >= 0 optional>');
    expect(prompt).toContain('"duration":<seconds >= 0 optional>');
    expect(prompt).toContain('"splitTime":<absolute seconds >= 0>');
    expect(prompt).toContain('"newStartTime":<seconds >= 0>');
    expect(prompt).toContain('"time":<seconds >= 0>');
    expect(prompt).toContain('"endTime":<seconds >= 0>');
  });

  it('큰 프로젝트 컨텍스트를 제한하고 잘림을 표시한다', () => {
    const manyTracks = Array.from(
      { length: 40 },
      (_, index): AgentPromptTrack => ({
        id: `${index.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`,
        index,
        regions: [
          {
            id: `${index.toString(16).padStart(8, '0')}-2222-4222-8222-222222222222`,
            startTime: index,
            endTime: index + 1,
            sourceStartTime: 0,
            duration: 1,
            hasAudioSource: true,
          },
        ],
      })
    );

    const prompt = getSystemPrompt({ tracks: manyTracks });
    const projectContext = prompt.split('# 현재 Track과 Region\n')[1].split('\n\n# 지원 명령')[0];

    expect(projectContext).toContain('Project context truncated');
    expect(projectContext.length).toBeLessThanOrEqual(AGENT_PROJECT_CONTEXT_MAX_CHARACTERS + 120);
  });
});
