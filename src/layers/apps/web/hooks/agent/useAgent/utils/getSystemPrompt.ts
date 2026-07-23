import {
  AudioCommandType,
  type AudioCommand,
  type AudioCommandType as AudioCommandName,
} from '@/types/audioCommand.schema';

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

export const AGENT_PROJECT_CONTEXT_MAX_CHARACTERS = 1600;
const EXAMPLE_PROJECT_ID = '99999999-9999-4999-8999-999999999999';

const COMMAND_REFERENCE = {
  [AudioCommandType.ADD_TRACK]: '{"type":"ADD_TRACK","trackId":"<new UUID>"} - 빈 Track 추가. 현재 Agent 생성은 금지',
  [AudioCommandType.REMOVE_TRACK]:
    '{"type":"REMOVE_TRACK","trackId":"<existing Track UUID>"} - Track과 포함된 Region을 제거',
  [AudioCommandType.PLAY]: '{"type":"PLAY"} - 재생',
  [AudioCommandType.PAUSE]: '{"type":"PAUSE"} - 현재 위치에서 일시정지',
  [AudioCommandType.STOP]: '{"type":"STOP"} - 정지하고 0초로 이동',
  [AudioCommandType.SET_TEMPO]: '{"type":"SET_TEMPO","tempo":<number greater than 0>} - 프로젝트 tempo 메타데이터 변경',
  [AudioCommandType.SET_TRACK_VOLUME]:
    '{"type":"SET_TRACK_VOLUME","trackId":"<existing Track UUID>","volume":<0..1>} - Track 볼륨 변경',
  [AudioCommandType.SET_TRACK_PAN]:
    '{"type":"SET_TRACK_PAN","trackId":"<existing Track UUID>","pan":<-1..1>} - Track 좌우 위치 변경',
  [AudioCommandType.SET_TRACK_MUTE]:
    '{"type":"SET_TRACK_MUTE","trackId":"<existing Track UUID>","muted":<boolean>} - Track 음소거 변경',
  [AudioCommandType.SET_TRACK_SOLO]:
    '{"type":"SET_TRACK_SOLO","trackId":"<existing Track UUID>","soloed":<boolean>} - Track solo 변경',
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
    request: '안녕',
    commands: [],
  },
] satisfies readonly AgentPromptExample[];

function createProjectContext(tracks: readonly AgentPromptTrack[]): AgentProjectContext {
  if (tracks.length === 0) {
    return { text: '(No tracks)', visibleTracks: [] };
  }

  const lines: string[] = [];
  const visibleTracks: AgentPromptTrack[] = [];
  let characterCount = 0;
  let visibleRegionCount = 0;
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

    const visibleRegions: AgentPromptRegion[] = [];
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
    visibleTracks.push({ ...track, regions: visibleRegions });

    if (visibleRegions.length < track.regions.length) {
      break;
    }
  }

  if (visibleTracks.length < tracks.length || visibleRegionCount < totalRegionCount) {
    lines.push(
      `(Project context truncated: shown ${visibleTracks.length}/${tracks.length} Tracks, ` +
        `${visibleRegionCount}/${totalRegionCount} Regions)`
    );
  }

  return { text: lines.join('\n'), visibleTracks };
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

function renderExamples(tracks: readonly AgentPromptTrack[]): string {
  return [...AGENT_PROMPT_EXAMPLES, ...createTargetExamples(tracks)]
    .map(example => `"${example.request}" → ${JSON.stringify(example.commands)}`)
    .join('\n');
}

export function getSystemPrompt({ tracks = [] }: { tracks?: readonly AgentPromptTrack[] }) {
  const projectContext = createProjectContext(tracks);

  return `# 역할
사용자 요청을 DAW AudioCommand JSON 배열로 변환한다.

# 현재 Track과 Region
${projectContext.text}

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
8. 숫자는 문자열이 아닌 number로 쓴다. 시간은 절대 초다. 백분율은 100으로 나눠 volume 0..1, pan -1..1로 바꾼다. boolean은 true 또는 false다.
9. 범위를 실제로 내보내려면 SET_EXPORT_RANGE 다음에 EXPORT_AUDIO를 둔다. endTime은 startTime보다 커야 한다.
10. 입력 의존 순서를 유지한다. EXPORT_AUDIO는 해당 묶음의 마지막에 둔다.
11. 편집과 저장을 함께 요청하면 SAVE_PROJECT를 해당 편집 명령 뒤에 둔다.
12. LOAD_PROJECT는 사용자가 Project UUID를 명시했을 때만 사용한다. Project UUID를 임의로 만들지 않고, 다른 명령과 같은 배열에 넣지 않는다.
13. 요청을 안전하게 실행할 정보가 부족하면 []를 반환한다. 지원하지 않는 요청도 []를 반환한다.

# 예시
${renderExamples(projectContext.visibleTracks)}
`;
}
