import { describe, expect, it } from 'vitest';
import { AgentAudioCommandBatchSchema, AudioCommandType } from '@/types/audioCommand.schema';
import {
  AGENT_PLUGIN_CONTEXT_MAX_CHARACTERS,
  AGENT_PROJECT_CONTEXT_MAX_CHARACTERS,
  AGENT_PROMPT_EXAMPLES,
  getSystemPrompt,
  type AgentPromptPlugin,
  type AgentPromptTrack,
} from './getSystemPrompt';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const SOURCE_ID = '33333333-3333-4333-8333-333333333333';
const PLUGIN_INSTANCE_ID = '44444444-4444-4444-8444-444444444444';
const plugins: AgentPromptPlugin[] = [
  {
    id: 'builtin.channel-tools',
    name: 'Channel Tools',
    version: '1.0.0',
    parameters: [
      { id: 'gain', name: 'Gain', type: 'number', minValue: 0, maxValue: 2, defaultValue: 1, step: 0.01 },
      { id: 'bypass', name: 'Bypass', type: 'boolean', defaultValue: false },
      {
        id: 'mode',
        name: 'Mode',
        type: 'enum',
        defaultValue: 'clean',
        options: [
          { value: 'clean', name: 'Clean' },
          { value: 'warm', name: 'Warm' },
        ],
      },
    ],
  },
];
const tracks: AgentPromptTrack[] = [
  {
    id: TRACK_ID,
    index: 0,
    pluginInstances: [
      {
        id: PLUGIN_INSTANCE_ID,
        manifestSummary: { id: 'builtin.channel-tools', name: 'Channel Tools', version: '1.0.0' },
        isEnabled: true,
        parameters: [
          { id: 'gain', value: 0.75 },
          { id: 'bypass', value: false },
          { id: 'mode', value: 'warm' },
        ],
      },
    ],
    regions: [
      {
        id: REGION_ID,
        startTime: 1,
        endTime: 4.5,
        sourceStartTime: 2,
        duration: 3.5,
        hasAudioSource: true,
        sourceId: SOURCE_ID,
      },
    ],
  },
];

describe('Agent 시스템 Prompt', () => {
  it('현재 AudioCommand를 모두 설명한다', () => {
    const prompt = getSystemPrompt({ tracks });

    for (const commandType of Object.values(AudioCommandType)) {
      expect(prompt).toContain(`- ${commandType}:`);
    }
  });

  it('트랙과 Region의 실제 식별자, 시간, Source ID, 소스 사용 가능 여부를 전달한다', () => {
    const prompt = getSystemPrompt({ tracks });

    expect(prompt).toContain(`Track 1: id=${TRACK_ID}`);
    expect(prompt).toContain(
      `Region 1: id=${REGION_ID}, startTime=1, endTime=4.5, sourceStartTime=2, duration=3.5, ` +
        `sourceId=${SOURCE_ID}, source=available`
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

    const renderedExamples = getSystemPrompt({ plugins, tracks }).split('# 예시\n')[1].trim().split('\n');
    for (const renderedExample of renderedExamples) {
      const commandJson = renderedExample.split(' → ')[1];
      expect(AgentAudioCommandBatchSchema.safeParse(JSON.parse(commandJson)).success).toBe(true);
    }
  });

  it('첫 Region 복제 예시는 원본 소스 범위를 유지한다', () => {
    const prompt = getSystemPrompt({ tracks });

    expect(prompt).toContain('"startOffset":2,"duration":3.5');
    expect(prompt).toContain(`"sourceId":"${SOURCE_ID}"`);
  });

  it('한국어와 영어 요청 예시를 모두 제공한다', () => {
    expect(AGENT_PROMPT_EXAMPLES.some(example => /[가-힣]/.test(example.request))).toBe(true);
    expect(AGENT_PROMPT_EXAMPLES.some(example => /^[A-Za-z0-9 .!?-]+$/.test(example.request))).toBe(true);
  });

  it('프로젝트 저장의 한국어·영어 예시와 실행 순서 규칙을 제공한다', () => {
    const prompt = getSystemPrompt({ tracks });

    expect(AGENT_PROMPT_EXAMPLES).toEqual(
      expect.arrayContaining([
        {
          request: '현재 프로젝트 저장해줘',
          commands: [{ type: AudioCommandType.SAVE_PROJECT }],
        },
        {
          request: 'save the current project',
          commands: [{ type: AudioCommandType.SAVE_PROJECT }],
        },
      ])
    );
    expect(prompt).toContain('{"type":"SAVE_PROJECT"}');
    expect(prompt).toContain('SAVE_PROJECT를 해당 편집 명령 뒤에 둔다');
  });

  it('프로젝트 불러오기의 한국어·영어 예시와 Project ID 안전 규칙을 제공한다', () => {
    const prompt = getSystemPrompt({ tracks });
    const loadExamples = AGENT_PROMPT_EXAMPLES.filter(example =>
      example.commands.some(command => command.type === AudioCommandType.LOAD_PROJECT)
    );

    expect(loadExamples.some(example => /[가-힣]/.test(example.request))).toBe(true);
    expect(loadExamples.some(example => /^load project /.test(example.request))).toBe(true);
    expect(prompt).toContain('{"type":"LOAD_PROJECT","projectId":"<user-provided Project UUID>"}');
    expect(prompt).toContain('Project UUID를 임의로 만들지 않고');
    expect(prompt).toContain('다른 명령과 같은 배열에 넣지 않는다');
  });

  it('Undo와 Redo의 한국어·영어 예시와 단독 실행 규칙을 제공한다', () => {
    const prompt = getSystemPrompt({ tracks });

    expect(AGENT_PROMPT_EXAMPLES).toEqual(
      expect.arrayContaining([
        { request: '마지막 편집 취소해줘', commands: [{ type: AudioCommandType.UNDO }] },
        { request: 'redo the last edit', commands: [{ type: AudioCommandType.REDO }] },
      ])
    );
    expect(prompt).toContain('{"type":"UNDO"}');
    expect(prompt).toContain('{"type":"REDO"}');
    expect(prompt).toContain('사용자가 명시적으로 요청했을 때만 사용한다');
    expect(prompt).toContain('UNDO와 REDO는 다른 명령과 같은 배열에 넣지 않는다');
  });

  it('출력 형식과 식별자, Source ID 안전 규칙을 명시한다', () => {
    const prompt = getSystemPrompt({ tracks });

    expect(prompt).toContain('JSON 배열만 반환');
    expect(prompt).toContain('기존 Track과 Region의 ID는 위 목록의 값만 사용');
    expect(prompt).toContain('url 필드는 폐기되어 사용할 수 없다');
    expect(prompt).toContain('sourceId를 임의로 만들지 않는다');
    expect(prompt).toContain('위 목록에 표시된 sourceId만 사용한다');
    expect(prompt).toContain('"sourceId":"<listed Source UUID>"');
    expect(prompt).not.toContain('"sourceId":"<listed Source UUID optional>"');
    expect(prompt).toContain('정보가 부족하면 []');
    expect(prompt).toContain('ADD_TRACK은 현재 Agent에서 사용하지 않는다');
    expect(prompt).toContain('{"type":"ADD_TRACK","trackId":"<new UUID>"}');
    expect(prompt).not.toContain('{"type":"ADD_TRACK","trackId":"<new UUID>","url"');
    expect(prompt).toContain('regionId는 생략');
    expect(prompt).not.toContain('"url":"<known URL optional>"');
  });

  it('Plugin context가 없을 때 Plugin 변경 명령을 금지한다', () => {
    const prompt = getSystemPrompt({});

    expect(prompt).toContain('INSTALL_PLUGIN, REMOVE_PLUGIN, SET_PLUGIN_PARAMETER 요청은 []를 반환한다');
    expect(prompt).toContain('INSTALL_PLUGIN');
    expect(prompt).toContain('REMOVE_PLUGIN');
    expect(prompt).toContain('SET_PLUGIN_PARAMETER');
  });

  it('Plugin catalog와 Track의 설치 인스턴스·현재 값을 전달한다', () => {
    const prompt = getSystemPrompt({ plugins, tracks });

    expect(prompt).toContain('manifestId=builtin.channel-tools, name=Channel Tools, version=1.0.0');
    expect(prompt).toContain('id=gain, name=Gain, type=number, default=1, range=0..2, step=0.01');
    expect(prompt).toContain('id=bypass, name=Bypass, type=boolean, default=false');
    expect(prompt).toContain('id=mode, name=Mode, type=enum, default=clean, options=[clean,warm]');
    expect(prompt).toContain(
      `instanceId=${PLUGIN_INSTANCE_ID}, manifestId=builtin.channel-tools, enabled=true, ` +
        'parameters=[gain=0.75,bypass=false,mode="warm"]'
    );
  });

  it('목록에 있는 Plugin과 Parameter만 사용하도록 제한한다', () => {
    const prompt = getSystemPrompt({ plugins, tracks });

    expect(prompt).not.toContain('현재 Agent 사용 금지');
    expect(prompt).not.toContain('INSTALL_PLUGIN, REMOVE_PLUGIN, SET_PLUGIN_PARAMETER 요청은 []를 반환한다');
    expect(prompt).toContain('INSTALL_PLUGIN은 위 catalog의 manifestId만 사용한다');
    expect(prompt).toContain('instanceId는 생략해 실행기가 생성하게 한다');
    expect(prompt).toContain('REMOVE_PLUGIN은 위 Track에 표시된 instanceId만 사용한다');
    expect(prompt).toContain('SET_PLUGIN_PARAMETER는 해당 manifest에 표시된 Parameter 계약을 지킨다');
    expect(prompt).toContain(`"manifestId":"builtin.channel-tools"`);
    expect(prompt).toContain(`"instanceId":"${PLUGIN_INSTANCE_ID}"`);
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
        pluginInstances: [],
        regions: [
          {
            id: `${index.toString(16).padStart(8, '0')}-2222-4222-8222-222222222222`,
            startTime: index,
            endTime: index + 1,
            sourceStartTime: 0,
            duration: 1,
            hasAudioSource: true,
            sourceId: SOURCE_ID,
          },
        ],
      })
    );

    const prompt = getSystemPrompt({ tracks: manyTracks });
    const projectContext = prompt.split('# 현재 Track과 Region\n')[1].split('\n\n# 지원 명령')[0];

    expect(projectContext).toContain('Project context truncated');
    expect(projectContext.length).toBeLessThanOrEqual(AGENT_PROJECT_CONTEXT_MAX_CHARACTERS + 120);
  });

  it('큰 Plugin catalog 컨텍스트를 제한하고 잘림을 표시한다', () => {
    const manyPlugins = Array.from(
      { length: 40 },
      (_, index): AgentPromptPlugin => ({
        id: `vendor.effect-${index}`,
        name: `Effect ${index}`,
        version: '1.0.0',
        parameters: Array.from({ length: 5 }, (__, parameterIndex) => ({
          id: `gain-${parameterIndex}`,
          name: `Gain ${parameterIndex}`,
          type: 'number',
          minValue: 0,
          maxValue: 2,
          defaultValue: 1,
        })),
      })
    );

    const prompt = getSystemPrompt({ plugins: manyPlugins });
    const pluginContext = prompt.split('# 사용 가능한 Plugin\n')[1].split('\n\n# 지원 명령')[0];

    expect(pluginContext).toContain('Plugin context truncated');
    expect(pluginContext.length).toBeLessThanOrEqual(AGENT_PLUGIN_CONTEXT_MAX_CHARACTERS + 120);
  });
});
