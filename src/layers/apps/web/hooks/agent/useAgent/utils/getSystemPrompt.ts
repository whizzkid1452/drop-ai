import {
  AudioCommandType,
  type AudioCommand,
  type AudioCommandType as AudioCommandName,
} from '@/types/audioCommand.schema';
import type { PluginCatalogEntry, PluginInstanceState, PluginParameterDefinition } from '@/types/plugin-state';

export type AgentPromptPlugin = PluginCatalogEntry;

export interface AgentPromptRegion {
  id: string;
  startTime: number;
  endTime: number;
  sourceStartTime: number;
  duration: number;
  hasAudioSource: boolean;
  sourceId: string;
}

export interface AgentPromptTrack {
  id: string;
  index: number;
  pluginInstances: readonly PluginInstanceState[];
  regions: readonly AgentPromptRegion[];
}

interface AgentPromptExample {
  request: string;
  commands: readonly AudioCommand[];
}

interface AgentProjectContext {
  text: string;
  visibleTracks: readonly AgentPromptTrack[];
}

interface AgentPluginContext {
  text: string;
  visiblePlugins: readonly AgentPromptPlugin[];
}

interface PluginSafetyRules {
  text: string;
  nextRuleNumber: number;
}

export const AGENT_PROJECT_CONTEXT_MAX_CHARACTERS = 1600;
export const AGENT_PLUGIN_CONTEXT_MAX_CHARACTERS = 1200;
const EXAMPLE_PROJECT_ID = '99999999-9999-4999-8999-999999999999';

const COMMAND_REFERENCE = {
  [AudioCommandType.UNDO]: '{"type":"UNDO"} - 마지막 편집 실행 취소',
  [AudioCommandType.REDO]: '{"type":"REDO"} - 마지막으로 취소한 편집 다시 실행',
  [AudioCommandType.ADD_TRACK]: '{"type":"ADD_TRACK","trackId":"<new UUID>"} - 빈 Track 추가. 현재 Agent 생성은 금지',
  [AudioCommandType.REMOVE_TRACK]:
    '{"type":"REMOVE_TRACK","trackId":"<existing Track UUID>"} - Track과 포함된 Region을 제거',
  [AudioCommandType.PLAY]: '{"type":"PLAY"} - 재생',
  [AudioCommandType.PAUSE]: '{"type":"PAUSE"} - 현재 위치에서 일시정지',
  [AudioCommandType.STOP]: '{"type":"STOP"} - 정지하고 0초로 이동',
  [AudioCommandType.SET_TEMPO]: '{"type":"SET_TEMPO","tempo":<number greater than 0>} - 프로젝트 tempo 메타데이터 변경',
  [AudioCommandType.SET_MASTER_VOLUME]: '{"type":"SET_MASTER_VOLUME","volume":<0..1>} - 전체 출력 볼륨 변경',
  [AudioCommandType.SET_TRACK_VOLUME]:
    '{"type":"SET_TRACK_VOLUME","trackId":"<existing Track UUID>","volume":<0..1>} - Track 볼륨 변경',
  [AudioCommandType.SET_TRACK_PAN]:
    '{"type":"SET_TRACK_PAN","trackId":"<existing Track UUID>","pan":<-1..1>} - Track 좌우 위치 변경',
  [AudioCommandType.SET_TRACK_MUTE]:
    '{"type":"SET_TRACK_MUTE","trackId":"<existing Track UUID>","muted":<boolean>} - Track 음소거 변경',
  [AudioCommandType.SET_TRACK_SOLO]:
    '{"type":"SET_TRACK_SOLO","trackId":"<existing Track UUID>","soloed":<boolean>} - Track solo 변경',
  [AudioCommandType.INSTALL_PLUGIN]:
    '{"type":"INSTALL_PLUGIN","trackId":"<existing Track UUID>","manifestId":"<listed manifest ID>"} - Plugin 설치',
  [AudioCommandType.REMOVE_PLUGIN]:
    '{"type":"REMOVE_PLUGIN","trackId":"<existing Track UUID>","instanceId":"<existing Plugin instance UUID>"} - Plugin 제거',
  [AudioCommandType.MOVE_PLUGIN]:
    '{"type":"MOVE_PLUGIN","trackId":"<existing Track UUID>","instanceId":"<existing Plugin instance UUID>","targetIndex":<listed zero-based chain index>} - Plugin 처리 순서 변경',
  [AudioCommandType.SET_PLUGIN_ENABLED]:
    '{"type":"SET_PLUGIN_ENABLED","trackId":"<existing Track UUID>","instanceId":"<existing Plugin instance UUID>","isEnabled":<boolean>} - Plugin 활성화 상태 변경',
  [AudioCommandType.SET_PLUGIN_PARAMETER]:
    '{"type":"SET_PLUGIN_PARAMETER","trackId":"<existing Track UUID>","instanceId":"<existing Plugin instance UUID>","parameterId":"<listed Parameter ID>","value":<boolean|number|string>} - Plugin Parameter 변경',
  [AudioCommandType.LOAD_REGION]:
    '{"type":"LOAD_REGION","trackId":"<existing Track UUID>","regionId":"<new UUID optional>","sourceId":"<listed Source UUID>","startTime":<seconds >= 0>,"startOffset":<seconds >= 0 optional>,"duration":<seconds >= 0 optional>} - Region 추가. Agent 복제에서는 duration > 0',
  [AudioCommandType.UNLOAD_REGION]:
    '{"type":"UNLOAD_REGION","trackId":"<existing Track UUID>","regionId":"<existing Region UUID>"} - Region 제거',
  [AudioCommandType.SPLIT_REGION]:
    '{"type":"SPLIT_REGION","trackId":"<existing Track UUID>","regionId":"<existing Region UUID>","splitTime":<absolute seconds >= 0>} - Region 내부를 분할',
  [AudioCommandType.MOVE_REGION]:
    '{"type":"MOVE_REGION","trackId":"<existing Track UUID>","regionId":"<existing Region UUID>","newStartTime":<seconds >= 0>} - Region 시작 위치 변경',
  [AudioCommandType.SET_CURRENT_TIME]: '{"type":"SET_CURRENT_TIME","time":<seconds >= 0>} - 재생 위치 변경',
  [AudioCommandType.SET_EXPORT_RANGE]:
    '{"type":"SET_EXPORT_RANGE","startTime":<seconds >= 0>,"endTime":<seconds >= 0>} - 내보내기 범위 선택. endTime > startTime',
  [AudioCommandType.CLEAR_EXPORT_RANGE]: '{"type":"CLEAR_EXPORT_RANGE"} - 내보내기 범위 해제',
  [AudioCommandType.EXPORT_AUDIO]:
    '{"type":"EXPORT_AUDIO","filename":"<optional filename>"} - 현재 선택 범위 또는 전체를 WAV로 내보내기',
  [AudioCommandType.SAVE_PROJECT]: '{"type":"SAVE_PROJECT"} - 현재 프로젝트와 오디오 원본 저장',
  [AudioCommandType.LOAD_PROJECT]:
    '{"type":"LOAD_PROJECT","projectId":"<user-provided Project UUID>"} - 저장된 프로젝트 불러오기',
} satisfies Record<AudioCommandName, string>;

export const AGENT_PROMPT_EXAMPLES = [
  {
    request: 'play',
    commands: [{ type: AudioCommandType.PLAY }],
  },
  {
    request: '템포를 128로 설정해줘',
    commands: [{ type: AudioCommandType.SET_TEMPO, tempo: 128 }],
  },
  {
    request: '전체 볼륨을 40%로 설정해줘',
    commands: [{ type: AudioCommandType.SET_MASTER_VOLUME, volume: 0.4 }],
  },
  {
    request: 'set the master volume to 40 percent',
    commands: [{ type: AudioCommandType.SET_MASTER_VOLUME, volume: 0.4 }],
  },
  {
    request: '3초부터 10초까지 WAV로 내보내줘',
    commands: [
      { type: AudioCommandType.SET_EXPORT_RANGE, startTime: 3, endTime: 10 },
      { type: AudioCommandType.EXPORT_AUDIO },
    ],
  },
  {
    request: '현재 프로젝트 저장해줘',
    commands: [{ type: AudioCommandType.SAVE_PROJECT }],
  },
  {
    request: 'save the current project',
    commands: [{ type: AudioCommandType.SAVE_PROJECT }],
  },
  {
    request: `${EXAMPLE_PROJECT_ID} 프로젝트 불러와줘`,
    commands: [{ type: AudioCommandType.LOAD_PROJECT, projectId: EXAMPLE_PROJECT_ID }],
  },
  {
    request: `load project ${EXAMPLE_PROJECT_ID}`,
    commands: [{ type: AudioCommandType.LOAD_PROJECT, projectId: EXAMPLE_PROJECT_ID }],
  },
  {
    request: '마지막 편집 취소해줘',
    commands: [{ type: AudioCommandType.UNDO }],
  },
  {
    request: 'redo the last edit',
    commands: [{ type: AudioCommandType.REDO }],
  },
  {
    request: '안녕',
    commands: [],
  },
] satisfies readonly AgentPromptExample[];

function renderPluginInstance(instance: PluginInstanceState, index: number): string {
  const parameters = instance.parameters
    .map(parameter => `${parameter.id}=${JSON.stringify(parameter.value)}`)
    .join(',');
  return (
    `  Plugin ${index + 1}: chainIndex=${index}, instanceId=${instance.id}, manifestId=${instance.manifestSummary.id}, ` +
    `enabled=${instance.isEnabled}, parameters=[${parameters}]`
  );
}

function createProjectContext(tracks: readonly AgentPromptTrack[]): AgentProjectContext {
  if (tracks.length === 0) {
    return { text: '(No tracks)', visibleTracks: [] };
  }

  const lines: string[] = [];
  const visibleTracks: AgentPromptTrack[] = [];
  let characterCount = 0;
  let visiblePluginInstanceCount = 0;
  let visibleRegionCount = 0;
  const totalPluginInstanceCount = tracks.reduce((count, track) => count + track.pluginInstances.length, 0);
  const totalRegionCount = tracks.reduce((count, track) => count + track.regions.length, 0);

  const tryAddLine = (line: string) => {
    const separatorLength = lines.length === 0 ? 0 : 1;
    if (characterCount + separatorLength + line.length > AGENT_PROJECT_CONTEXT_MAX_CHARACTERS) {
      return false;
    }

    lines.push(line);
    characterCount += separatorLength + line.length;
    return true;
  };

  for (const track of tracks) {
    if (!tryAddLine(`Track ${track.index + 1}: id=${track.id}`)) {
      break;
    }

    const visiblePluginInstances: PluginInstanceState[] = [];
    for (const [index, instance] of track.pluginInstances.entries()) {
      if (!tryAddLine(renderPluginInstance(instance, index))) {
        break;
      }
      visiblePluginInstances.push(instance);
      visiblePluginInstanceCount += 1;
    }

    const visibleRegions: AgentPromptRegion[] = [];
    if (visiblePluginInstances.length === track.pluginInstances.length) {
      for (const [index, region] of track.regions.entries()) {
        const regionLine =
          `  Region ${index + 1}: id=${region.id}, startTime=${region.startTime}, endTime=${region.endTime}, ` +
          `sourceStartTime=${region.sourceStartTime}, duration=${region.duration}, ` +
          `sourceId=${region.sourceId}, ` +
          `source=${region.hasAudioSource ? 'available' : 'unavailable'}`;
        if (!tryAddLine(regionLine)) {
          break;
        }

        visibleRegions.push(region);
        visibleRegionCount += 1;
      }
    }
    visibleTracks.push({ ...track, pluginInstances: visiblePluginInstances, regions: visibleRegions });

    if (visiblePluginInstances.length < track.pluginInstances.length || visibleRegions.length < track.regions.length) {
      break;
    }
  }

  if (
    visibleTracks.length < tracks.length ||
    visiblePluginInstanceCount < totalPluginInstanceCount ||
    visibleRegionCount < totalRegionCount
  ) {
    lines.push(
      `(Project context truncated: shown ${visibleTracks.length}/${tracks.length} Tracks, ` +
        `${visiblePluginInstanceCount}/${totalPluginInstanceCount} Plugin instances, ` +
        `${visibleRegionCount}/${totalRegionCount} Regions)`
    );
  }

  return { text: lines.join('\n'), visibleTracks };
}

function renderPluginParameter(parameter: PluginParameterDefinition, index: number): string {
  const prefix = `  Parameter ${index + 1}: id=${parameter.id}, name=${parameter.name}, type=${parameter.type}`;
  if (parameter.type === 'number') {
    const step = parameter.step === undefined ? '' : `, step=${parameter.step}`;
    return `${prefix}, default=${parameter.defaultValue}, range=${parameter.minValue}..${parameter.maxValue}` + step;
  }
  if (parameter.type === 'boolean') {
    return `${prefix}, default=${parameter.defaultValue}`;
  }
  return (
    `${prefix}, default=${parameter.defaultValue}, ` +
    `options=[${parameter.options.map(option => option.value).join(',')}]`
  );
}

function createPluginContext(plugins: readonly AgentPromptPlugin[]): AgentPluginContext {
  if (plugins.length === 0) {
    return { text: '(No Plugin manifests)', visiblePlugins: [] };
  }

  const lines: string[] = [];
  const visiblePlugins: AgentPromptPlugin[] = [];
  let characterCount = 0;
  let visibleParameterCount = 0;
  const totalParameterCount = plugins.reduce((count, plugin) => count + plugin.parameters.length, 0);
  const tryAddLine = (line: string) => {
    const separatorLength = lines.length === 0 ? 0 : 1;
    if (characterCount + separatorLength + line.length > AGENT_PLUGIN_CONTEXT_MAX_CHARACTERS) {
      return false;
    }
    lines.push(line);
    characterCount += separatorLength + line.length;
    return true;
  };

  for (const [pluginIndex, plugin] of plugins.entries()) {
    if (
      !tryAddLine(`Plugin ${pluginIndex + 1}: manifestId=${plugin.id}, name=${plugin.name}, version=${plugin.version}`)
    ) {
      break;
    }
    const visibleParameters: PluginParameterDefinition[] = [];
    for (const [parameterIndex, parameter] of plugin.parameters.entries()) {
      if (!tryAddLine(renderPluginParameter(parameter, parameterIndex))) {
        break;
      }
      visibleParameters.push(parameter);
      visibleParameterCount += 1;
    }
    visiblePlugins.push({ ...plugin, parameters: visibleParameters });
    if (visibleParameters.length < plugin.parameters.length) {
      break;
    }
  }

  if (visiblePlugins.length < plugins.length || visibleParameterCount < totalParameterCount) {
    lines.push(
      `(Plugin context truncated: shown ${visiblePlugins.length}/${plugins.length} manifests, ` +
        `${visibleParameterCount}/${totalParameterCount} Parameters)`
    );
  }
  return { text: lines.join('\n'), visiblePlugins };
}

function renderCommandReference(): string {
  return Object.values(AudioCommandType)
    .map(commandType => `- ${commandType}: ${COMMAND_REFERENCE[commandType]}`)
    .join('\n');
}

function createTargetExamples(tracks: readonly AgentPromptTrack[]): AgentPromptExample[] {
  const firstTrack = tracks[0];
  if (!firstTrack) {
    return [];
  }

  const examples: AgentPromptExample[] = [
    {
      request: '첫 번째 트랙을 음소거해줘',
      commands: [{ type: AudioCommandType.SET_TRACK_MUTE, trackId: firstTrack.id, muted: true }],
    },
  ];
  const firstRegion = firstTrack.regions[0];
  if (!firstRegion || firstRegion.endTime <= firstRegion.startTime) {
    return examples;
  }

  const splitTime = (firstRegion.startTime + firstRegion.endTime) / 2;
  examples.push({
    request: `split the first region at ${splitTime} seconds`,
    commands: [
      {
        type: AudioCommandType.SPLIT_REGION,
        trackId: firstTrack.id,
        regionId: firstRegion.id,
        splitTime,
      },
    ],
  });
  if (firstRegion.hasAudioSource && firstRegion.duration > 0) {
    examples.push({
      request: `첫 번째 Region 소스를 ${firstRegion.endTime}초 위치에 복제해줘`,
      commands: [
        {
          type: AudioCommandType.LOAD_REGION,
          trackId: firstTrack.id,
          startTime: firstRegion.endTime,
          startOffset: firstRegion.sourceStartTime,
          duration: firstRegion.duration,
          sourceId: firstRegion.sourceId,
        },
      ],
    });
  }
  return examples;
}

function createPluginExamples(
  tracks: readonly AgentPromptTrack[],
  plugins: readonly AgentPromptPlugin[]
): AgentPromptExample[] {
  const firstTrack = tracks[0];
  const firstPlugin = plugins[0];
  if (!firstTrack || !firstPlugin) {
    return [];
  }

  const examples: AgentPromptExample[] = [
    {
      request: `첫 번째 트랙에 ${firstPlugin.name} Plugin을 설치해줘`,
      commands: [
        {
          type: AudioCommandType.INSTALL_PLUGIN,
          trackId: firstTrack.id,
          manifestId: firstPlugin.id,
        },
      ],
    },
  ];
  const trackWithInstance = tracks.find(track => track.pluginInstances.length > 0);
  const instance = trackWithInstance?.pluginInstances[0];
  if (!trackWithInstance || !instance) {
    return examples;
  }

  examples.push({
    request: `Plugin instance ${instance.id}를 제거해줘`,
    commands: [
      {
        type: AudioCommandType.REMOVE_PLUGIN,
        trackId: trackWithInstance.id,
        instanceId: instance.id,
      },
    ],
  });
  examples.push({
    request: `Plugin instance ${instance.id}를 ${instance.isEnabled ? '꺼줘' : '켜줘'}`,
    commands: [
      {
        type: AudioCommandType.SET_PLUGIN_ENABLED,
        trackId: trackWithInstance.id,
        instanceId: instance.id,
        isEnabled: !instance.isEnabled,
      },
    ],
  });
  if (trackWithInstance.pluginInstances.length > 1) {
    examples.push({
      request: `Plugin instance ${instance.id}를 두 번째 순서로 이동해줘`,
      commands: [
        {
          type: AudioCommandType.MOVE_PLUGIN,
          trackId: trackWithInstance.id,
          instanceId: instance.id,
          targetIndex: 1,
        },
      ],
    });
  }
  const manifest = plugins.find(plugin => plugin.id === instance.manifestSummary.id);
  const parameter = manifest?.parameters[0];
  if (!parameter) {
    return examples;
  }
  examples.push({
    request: `${instance.id} Plugin의 ${parameter.name} 값을 기본값으로 바꿔줘`,
    commands: [
      {
        type: AudioCommandType.SET_PLUGIN_PARAMETER,
        trackId: trackWithInstance.id,
        instanceId: instance.id,
        parameterId: parameter.id,
        value: parameter.defaultValue,
      },
    ],
  });
  return examples;
}

function renderExamples(tracks: readonly AgentPromptTrack[], plugins: readonly AgentPromptPlugin[]): string {
  return [...AGENT_PROMPT_EXAMPLES, ...createTargetExamples(tracks), ...createPluginExamples(tracks, plugins)]
    .map(example => `"${example.request}" → ${JSON.stringify(example.commands)}`)
    .join('\n');
}

function createPluginSafetyRules(
  projectContext: AgentProjectContext,
  pluginContext: AgentPluginContext
): PluginSafetyRules {
  const hasVisiblePluginInstance = projectContext.visibleTracks.some(track => track.pluginInstances.length > 0);
  if (pluginContext.visiblePlugins.length > 0) {
    return {
      text: `14. INSTALL_PLUGIN은 위 catalog의 manifestId만 사용한다. instanceId는 생략해 실행기가 생성하게 한다.
15. REMOVE_PLUGIN과 SET_PLUGIN_ENABLED는 위 Track에 표시된 instanceId만 사용한다. 그 instance가 표시된 trackId를 함께 쓴다.
16. MOVE_PLUGIN은 같은 Track에 표시된 chainIndex만 targetIndex로 사용한다.
17. SET_PLUGIN_ENABLED의 isEnabled는 boolean만 쓴다.
18. SET_PLUGIN_PARAMETER는 해당 manifest에 표시된 Parameter 계약을 지킨다. number는 범위 안의 number, boolean은 boolean, enum은 options 중 string을 쓴다.
19. 목록에 없는 manifestId, instanceId, Parameter ID나 값을 만들거나 추측하지 않는다.`,
      nextRuleNumber: 20,
    };
  }
  if (hasVisiblePluginInstance) {
    return {
      text: `14. Plugin manifest 목록이 없으므로 INSTALL_PLUGIN과 SET_PLUGIN_PARAMETER 요청은 []를 반환한다.
15. REMOVE_PLUGIN과 SET_PLUGIN_ENABLED는 위 Track에 표시된 instanceId만 사용한다. 그 instance가 표시된 trackId를 함께 쓴다.
16. MOVE_PLUGIN은 같은 Track에 표시된 chainIndex만 targetIndex로 사용한다.
17. SET_PLUGIN_ENABLED의 isEnabled는 boolean만 쓴다.`,
      nextRuleNumber: 18,
    };
  }
  return {
    text: '14. 현재 Plugin manifest와 instance 목록은 제공되지 않는다. INSTALL_PLUGIN, REMOVE_PLUGIN, MOVE_PLUGIN, SET_PLUGIN_ENABLED, SET_PLUGIN_PARAMETER 요청은 []를 반환한다.',
    nextRuleNumber: 15,
  };
}

export function getSystemPrompt({
  plugins = [],
  tracks = [],
}: {
  plugins?: readonly AgentPromptPlugin[];
  tracks?: readonly AgentPromptTrack[];
}) {
  const projectContext = createProjectContext(tracks);
  const pluginContext = createPluginContext(plugins);
  const pluginSafetyRules = createPluginSafetyRules(projectContext, pluginContext);

  return `# 역할
사용자 요청을 DAW AudioCommand JSON 배열로 변환한다.

# 현재 Track과 Region
${projectContext.text}

# 사용 가능한 Plugin
${pluginContext.text}

# 지원 명령
${renderCommandReference()}

# 출력과 안전 규칙
1. 설명, Markdown, 코드 블록 없이 JSON 배열만 반환한다. 각 객체에는 명령 정의에 있는 필드만 넣는다.
2. 기존 Track과 Region의 ID는 위 목록의 값만 사용한다. 이름이나 순번은 목록의 실제 ID로 바꾼다.
3. 앱이 예약한 새 ID가 없으므로 새 UUID를 만들지 않는다. LOAD_REGION의 regionId는 생략해 실행기가 생성하게 한다.
4. LOAD_REGION의 url 필드는 폐기되어 사용할 수 없다. sourceId를 임의로 만들지 않는다. 위 목록에 표시된 sourceId만 사용한다.
5. ADD_TRACK은 현재 Agent에서 사용하지 않는다. 새 파일이나 새 Track이 필요한 요청은 []를 반환한다.
6. LOAD_REGION은 사용자가 첫 Region 소스 복제를 명시했고 source가 available일 때만 사용한다. 목록에 표시된 sourceId를 포함하고 regionId는 생략한다. 첫 Region의 sourceStartTime과 duration은 그대로 쓴다. 두 번째 이후 Region의 소스 복제에는 사용하지 않는다.
7. Region 제거, 분할, 이동 명령은 trackId와 regionId를 생략하지 않는다.
8. 숫자는 문자열이 아닌 number로 쓴다. 시간은 절대 초다. 백분율은 100으로 나눠 Track volume과 Master Volume은 0..1, pan은 -1..1로 바꾼다. boolean은 true 또는 false다.
9. 범위를 실제로 내보내려면 SET_EXPORT_RANGE 다음에 EXPORT_AUDIO를 둔다. endTime은 startTime보다 커야 한다.
10. 입력 의존 순서를 유지한다. EXPORT_AUDIO는 해당 묶음의 마지막에 둔다.
11. 편집과 저장을 함께 요청하면 SAVE_PROJECT를 해당 편집 명령 뒤에 둔다.
12. LOAD_PROJECT는 사용자가 Project UUID를 명시했을 때만 사용한다. Project UUID를 임의로 만들지 않고, 다른 명령과 같은 배열에 넣지 않는다.
13. UNDO와 REDO는 사용자가 명시적으로 요청했을 때만 사용한다. UNDO와 REDO는 다른 명령과 같은 배열에 넣지 않는다.
${pluginSafetyRules.text}
${pluginSafetyRules.nextRuleNumber}. 요청을 안전하게 실행할 정보가 부족하면 []를 반환한다. 지원하지 않는 요청도 []를 반환한다.

# 예시
${renderExamples(projectContext.visibleTracks, pluginContext.visiblePlugins)}
`;
}
