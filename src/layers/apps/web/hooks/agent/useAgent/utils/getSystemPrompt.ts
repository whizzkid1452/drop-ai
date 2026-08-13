import {
  AudioCommandType,
  type AudioCommand,
  type AudioCommandType as AudioCommandName,
} from '@/types/audioCommand.schema';
import type { PluginCatalogEntry, PluginInstanceState, PluginParameterDefinition } from '@/types/plugin-state';
import type { LoopSlotState } from '@/layers/session/session';

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
  name: string;
  pluginInstances: readonly PluginInstanceState[];
  regions: readonly AgentPromptRegion[];
  loopSlots?: ReadonlyArray<
    Pick<LoopSlotState, 'id' | 'lengthBars' | 'overdubSourceIds' | 'quantizationBars' | 'sourceId' | 'state'>
  >;
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
  [AudioCommandType.SET_AUDIO_INPUT_DEVICE]:
    '{"type":"SET_AUDIO_INPUT_DEVICE","deviceId":"<browser audio input device ID or null>"} - 실시간 입력 장치 선택',
  [AudioCommandType.SET_INPUT_MONITORING]:
    '{"type":"SET_INPUT_MONITORING","trackId":"<existing Track UUID>","enabled":<boolean>} - 입력 모니터링 설정',
  [AudioCommandType.SET_TRACK_RECORD_ARM]:
    '{"type":"SET_TRACK_RECORD_ARM","trackId":"<existing Track UUID>","armed":<boolean>} - Track 녹음 arm 변경',
  [AudioCommandType.SET_TRACK_RECORDING_INPUT]:
    '{"type":"SET_TRACK_RECORDING_INPUT","trackId":"<existing Track UUID>","deviceId":"<device ID or null>","channelIndex":<integer >= 0>} - Track 입력 Route 변경',
  [AudioCommandType.SET_PUNCH_RECORDING]:
    '{"type":"SET_PUNCH_RECORDING","isEnabled":<boolean>,"range":{"startTimeSeconds":<seconds>,"endTimeSeconds":<seconds>}|null} - Punch 범위 변경',
  [AudioCommandType.SET_TRACK_RECORD_MODE]:
    '{"type":"SET_TRACK_RECORD_MODE","trackId":"<existing Track UUID>","recordMode":"soundOnSound|nonLayered|layered"} - Track 녹음 모드 변경',
  [AudioCommandType.SELECT_TAKE]:
    '{"type":"SELECT_TAKE","trackId":"<Track UUID>","playlistId":"<Playlist UUID>","takeId":"<Take UUID>"} - 전체 Take를 활성 Comp로 선택',
  [AudioCommandType.SET_COMP_SEGMENTS]:
    '{"type":"SET_COMP_SEGMENTS","trackId":"<Track UUID>","playlistId":"<Playlist UUID>","compSegments":[]} - Playlist Comp 구간 교체',
  [AudioCommandType.START_RECORDING]:
    '{"type":"START_RECORDING","countInBars":<0..4 integer>,"prerollSeconds":<0..60>} - arm된 Track 선형 녹음 시작',
  [AudioCommandType.STOP_RECORDING]:
    '{"type":"STOP_RECORDING"} - 녹음을 끝내고 성공한 Track별 RecordedTake를 Region으로 저장',
  [AudioCommandType.CANCEL_RECORDING]: '{"type":"CANCEL_RECORDING"} - 진행 중인 녹음을 저장하지 않고 취소',
  [AudioCommandType.ARM_LOOP_SLOT]:
    '{"type":"ARM_LOOP_SLOT","trackId":"<existing Track UUID>","slotId":"<existing Loop Slot UUID>","lengthBars":<1|2|4|8>,"quantizationBars":<1|2|4|8>} - 루프 녹음 대기',
  [AudioCommandType.ARM_LOOP_OVERDUB]:
    '{"type":"ARM_LOOP_OVERDUB","trackId":"<existing Track UUID>","slotId":"<existing Loop Slot UUID>"} - 재생 중인 루프에 별도 오버더빙 레이어 녹음',
  [AudioCommandType.CANCEL_LOOP_SLOT]:
    '{"type":"CANCEL_LOOP_SLOT","trackId":"<existing Track UUID>","slotId":"<existing Loop Slot UUID>"} - 루프 녹음 대기 취소',
  [AudioCommandType.TRIGGER_LOOP_SLOT]:
    '{"type":"TRIGGER_LOOP_SLOT","trackId":"<existing Track UUID>","slotId":"<existing Loop Slot UUID>"} - 루프 재생 예약',
  [AudioCommandType.STOP_LOOP_SLOT]:
    '{"type":"STOP_LOOP_SLOT","trackId":"<existing Track UUID>","slotId":"<existing Loop Slot UUID>"} - 루프 정지 예약',
  [AudioCommandType.CLEAR_LOOP_SLOT]:
    '{"type":"CLEAR_LOOP_SLOT","trackId":"<existing Track UUID>","slotId":"<existing Loop Slot UUID>"} - 루프 슬롯 비우기',
  [AudioCommandType.STOP_ALL_LOOPS]: '{"type":"STOP_ALL_LOOPS"} - 모든 루프 정지 예약',
  [AudioCommandType.UNDO]: '{"type":"UNDO"} - 마지막 편집 실행 취소',
  [AudioCommandType.REDO]: '{"type":"REDO"} - 마지막으로 취소한 편집 다시 실행',
  [AudioCommandType.ADD_TRACK]:
    '{"type":"ADD_TRACK","trackId":"<new UUID>"} - 빈 Track 추가. kind(audio|aux|bus|folder|vca)와 channelCount(1|2)는 선택 사항. 현재 Agent 생성은 금지',
  [AudioCommandType.REMOVE_TRACK]:
    '{"type":"REMOVE_TRACK","trackId":"<existing Track UUID>"} - Track과 포함된 Region을 제거',
  [AudioCommandType.PLAY]: '{"type":"PLAY"} - 재생',
  [AudioCommandType.PAUSE]: '{"type":"PAUSE"} - 현재 위치에서 일시정지',
  [AudioCommandType.STOP]: '{"type":"STOP"} - 정지하고 0초로 이동',
  [AudioCommandType.SET_TEMPO]:
    '{"type":"SET_TEMPO","tempo":<number greater than 0>} - 프로젝트 Tempo Map과 재생 scheduler 변경',
  [AudioCommandType.SET_MASTER_VOLUME]: '{"type":"SET_MASTER_VOLUME","volume":<0..1>} - 전체 출력 볼륨 변경',
  [AudioCommandType.SET_MONITOR_STATE]:
    '{"type":"SET_MONITOR_STATE","isCut":<boolean>,"isDimmed":<boolean>,"isMono":<boolean>} - Monitor cut·dim·mono 변경',
  [AudioCommandType.SET_ROUTING_GRAPH]:
    '{"type":"SET_ROUTING_GRAPH","graph":{"routes":[],"sends":[]}} - 전체 Route graph 교체',
  [AudioCommandType.SET_TRACK_ROUTING]:
    '{"type":"SET_TRACK_ROUTING","trackId":"<Track UUID>","kind":"audio|aux|bus|folder|vca","channelCount":<1|2>,"output":{"kind":"master|track|none"}} - Track 종류와 출력 Route 변경',
  [AudioCommandType.ADD_SEND]:
    '{"type":"ADD_SEND","id":"<new UUID>","sourceTrackId":"<Track UUID>","destinationTrackId":"<Aux or Bus UUID>","gain":<0..1>,"tapPoint":"preFader|postFader","isEnabled":<boolean>} - Send 추가',
  [AudioCommandType.UPDATE_SEND]:
    '{"type":"UPDATE_SEND","id":"<Send UUID>","gain":<0..1>,"tapPoint":"preFader|postFader","isEnabled":<boolean>} - Send 설정 변경',
  [AudioCommandType.REMOVE_SEND]: '{"type":"REMOVE_SEND","id":"<Send UUID>"} - Send 제거',
  [AudioCommandType.SET_TRACK_GROUPS]:
    '{"type":"SET_TRACK_GROUPS","trackId":"<Track UUID>","folderId":"<Folder UUID or null>","vcaIds":["<VCA UUID>"]} - Folder와 VCA 소속 변경',
  [AudioCommandType.SET_TIMELINE_MAP]:
    '{"type":"SET_TIMELINE_MAP","tempoChanges":[{"quarterNotePosition":0,"bpm":120}],"meterChanges":[{"quarterNotePosition":0,"beatsPerBar":4,"beatUnit":4}]} - Tempo·Meter Map 전체 변경',
  [AudioCommandType.SET_TIMELINE_MARKERS]:
    '{"type":"SET_TIMELINE_MARKERS","markers":[{"id":"<UUID>","name":"Verse","quarterNotePosition":8}]} - Timeline Marker 전체 변경',
  [AudioCommandType.SET_LOOP_RANGE]:
    '{"type":"SET_LOOP_RANGE","startTimeSeconds":2,"endTimeSeconds":8} - 초 단위 Loop 범위 설정',
  [AudioCommandType.CLEAR_LOOP_RANGE]: '{"type":"CLEAR_LOOP_RANGE"} - Loop 범위 해제',
  [AudioCommandType.SET_LOOP_ENABLED]:
    '{"type":"SET_LOOP_ENABLED","isEnabled":<boolean>} - 설정된 Loop 범위 반복 여부 변경',
  [AudioCommandType.SET_METRONOME]:
    '{"type":"SET_METRONOME","isEnabled":<boolean>,"volume":<0..1>} - Metronome 상태와 볼륨 변경',
  [AudioCommandType.SET_TRACK_NAME]:
    '{"type":"SET_TRACK_NAME","trackId":"<existing Track UUID>","name":"<1..255 non-blank characters>"} - Track 이름 변경',
  [AudioCommandType.SET_TRACK_VOLUME]:
    '{"type":"SET_TRACK_VOLUME","trackId":"<existing Track UUID>","volume":<0..1>} - Track 볼륨 변경',
  [AudioCommandType.SET_TRACK_PAN]:
    '{"type":"SET_TRACK_PAN","trackId":"<existing Track UUID>","pan":<-1..1>} - Track 좌우 위치 변경',
  [AudioCommandType.SET_TRACK_MUTE]:
    '{"type":"SET_TRACK_MUTE","trackId":"<existing Track UUID>","muted":<boolean>} - Track 음소거 변경',
  [AudioCommandType.SET_TRACK_SOLO]:
    '{"type":"SET_TRACK_SOLO","trackId":"<existing Track UUID>","soloed":<boolean>} - Track solo 변경',
  [AudioCommandType.SET_AUTOMATION_LANES]:
    '{"type":"SET_AUTOMATION_LANES","trackId":"<existing Track UUID>","automationLanes":[]} - Track Automation lane 전체 교체',
  [AudioCommandType.PREVIEW_AUTOMATION_WRITE_PASS]:
    'UI 전용 runtime 명령 - Automation write pass sample을 저장하지 않고 미리 듣기',
  [AudioCommandType.COMMIT_AUTOMATION_WRITE_PASS]:
    'UI 전용 편집 명령 - Automation write pass sample 묶음을 한 번의 Undo 단위로 확정',
  [AudioCommandType.CANCEL_AUTOMATION_WRITE_PREVIEW]:
    'UI 전용 runtime 명령 - Automation write preview를 저장된 lane으로 복원',
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
  [AudioCommandType.SET_EDITOR_SELECTION]:
    '{"type":"SET_EDITOR_SELECTION","editPointSeconds":<seconds >= 0>,"range":null,"regions":[{"trackId":"<Track UUID>","regionId":"<Region UUID>"}],"trackIds":["<Track UUID>"]} - 편집 대상과 edit point 변경',
  [AudioCommandType.COPY_SELECTED_REGIONS]: '{"type":"COPY_SELECTED_REGIONS"} - 선택 Region을 runtime Clipboard에 복사',
  [AudioCommandType.CUT_SELECTED_REGIONS]:
    '{"type":"CUT_SELECTED_REGIONS"} - 선택 Region을 runtime Clipboard로 옮기고 Timeline에서 제거',
  [AudioCommandType.PASTE_REGIONS]: '{"type":"PASTE_REGIONS"} - runtime Clipboard Region을 현재 edit point에 붙여넣기',
  [AudioCommandType.DUPLICATE_SELECTED_REGIONS]:
    '{"type":"DUPLICATE_SELECTED_REGIONS","offsetSeconds":<seconds > 0>} - 선택 Region을 지정한 간격 뒤에 복제',
  [AudioCommandType.NUDGE_SELECTED_REGIONS]:
    '{"type":"NUDGE_SELECTED_REGIONS","deltaSeconds":<non-zero finite seconds>} - 선택 Region을 상대 이동',
  [AudioCommandType.ALIGN_SELECTED_REGIONS]:
    '{"type":"ALIGN_SELECTED_REGIONS","edge":"start|end","targetTimeSeconds":<seconds >= 0>} - 선택 Region의 시작 또는 끝을 같은 시각에 정렬',
  [AudioCommandType.TRIM_REGION]:
    '{"type":"TRIM_REGION","trackId":"<Track UUID>","regionId":"<Region UUID>","startTimeSeconds":<seconds >= 0>,"sourceStartTimeSeconds":<seconds >= 0>,"durationSeconds":<seconds > 0>} - 원본을 보존하며 Region 범위 변경',
  [AudioCommandType.SLIP_REGION]:
    '{"type":"SLIP_REGION","trackId":"<Track UUID>","regionId":"<Region UUID>","sourceStartTimeSeconds":<seconds >= 0>} - Timeline 위치를 유지하며 Source 시작 위치 변경',
  [AudioCommandType.SET_REGION_PROCESSING]:
    '{"type":"SET_REGION_PROCESSING","trackId":"<Track UUID>","regionId":"<Region UUID>","gain":<number >= 0>} - Region gain·Fade·layer·opaque 처리값 변경',
  [AudioCommandType.CREATE_REGION_CROSSFADE]:
    '{"type":"CREATE_REGION_CROSSFADE","trackId":"<Track UUID>","fadeOutRegionId":"<Region UUID>","fadeInRegionId":"<Region UUID>","crossfadeId":"<new UUID>","curve":"linear|equalPower"} - 겹치는 두 Region에 Crossfade 생성',
  [AudioCommandType.REMOVE_REGION_CROSSFADE]:
    '{"type":"REMOVE_REGION_CROSSFADE","trackId":"<Track UUID>","crossfadeId":"<Crossfade UUID>"} - Crossfade 제거',
  [AudioCommandType.NORMALIZE_SELECTED_REGIONS]:
    '{"type":"NORMALIZE_SELECTED_REGIONS","targetPeak":<0..1>} - 원본 Source를 바꾸지 않고 선택 Region gain 정규화',
  [AudioCommandType.REVERSE_SELECTED_REGIONS]:
    '{"type":"REVERSE_SELECTED_REGIONS"} - 선택 Region 범위를 뒤집은 파생 Source 생성',
  [AudioCommandType.STRIP_SILENCE_SELECTED_REGIONS]:
    '{"type":"STRIP_SILENCE_SELECTED_REGIONS","thresholdDb":<-120..0>,"minimumSilenceSeconds":<seconds > 0>} - 선택 Region의 연속 무음을 제거한 파생 Source 생성',
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
    request: 'set export range from 0:00 to 1:30',
    commands: [{ type: AudioCommandType.SET_EXPORT_RANGE, startTime: 0, endTime: 90 }],
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
  let visibleLoopSlotCount = 0;
  let visiblePluginInstanceCount = 0;
  let visibleRegionCount = 0;
  const totalLoopSlotCount = tracks.reduce((count, track) => count + (track.loopSlots?.length ?? 0), 0);
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
    if (!tryAddLine(`Track ${track.index + 1}: id=${track.id}, name=${JSON.stringify(track.name)}`)) {
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
    const visibleLoopSlots: Array<
      Pick<LoopSlotState, 'id' | 'lengthBars' | 'overdubSourceIds' | 'quantizationBars' | 'sourceId' | 'state'>
    > = [];
    if (visiblePluginInstances.length === track.pluginInstances.length) {
      for (const [index, loopSlot] of (track.loopSlots ?? []).entries()) {
        const loopSlotLine =
          `  Loop Slot ${index + 1}: id=${loopSlot.id}, state=${loopSlot.state}, ` +
          `lengthBars=${loopSlot.lengthBars}, quantizationBars=${loopSlot.quantizationBars}, ` +
          `source=${loopSlot.sourceId === null ? 'empty' : 'available'}, ` +
          `layers=${loopSlot.sourceId === null ? 0 : 1 + loopSlot.overdubSourceIds.length}`;
        if (!tryAddLine(loopSlotLine)) {
          break;
        }
        visibleLoopSlots.push(loopSlot);
        visibleLoopSlotCount += 1;
      }
    }
    if (
      visiblePluginInstances.length === track.pluginInstances.length &&
      visibleLoopSlots.length === (track.loopSlots?.length ?? 0)
    ) {
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
    visibleTracks.push({
      ...track,
      loopSlots: visibleLoopSlots,
      pluginInstances: visiblePluginInstances,
      regions: visibleRegions,
    });

    if (
      visiblePluginInstances.length < track.pluginInstances.length ||
      visibleLoopSlots.length < (track.loopSlots?.length ?? 0) ||
      visibleRegions.length < track.regions.length
    ) {
      break;
    }
  }

  if (
    visibleTracks.length < tracks.length ||
    visibleLoopSlotCount < totalLoopSlotCount ||
    visiblePluginInstanceCount < totalPluginInstanceCount ||
    visibleRegionCount < totalRegionCount
  ) {
    lines.push(
      `(Project context truncated: shown ${visibleTracks.length}/${tracks.length} Tracks, ` +
        `${visiblePluginInstanceCount}/${totalPluginInstanceCount} Plugin instances, ` +
        `${visibleLoopSlotCount}/${totalLoopSlotCount} Loop Slots, ` +
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
      request: '첫 번째 Track 이름을 Lead Vocal로 바꿔줘',
      commands: [{ type: AudioCommandType.SET_TRACK_NAME, trackId: firstTrack.id, name: 'Lead Vocal' }],
    },
    {
      request: 'rename the first track to Lead Vocal',
      commands: [{ type: AudioCommandType.SET_TRACK_NAME, trackId: firstTrack.id, name: 'Lead Vocal' }],
    },
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

function createLoopExamples(tracks: readonly AgentPromptTrack[]): AgentPromptExample[] {
  const firstTrack = tracks.find(track => (track.loopSlots?.length ?? 0) > 0);
  const firstLoopSlot = firstTrack?.loopSlots?.[0];
  if (!firstTrack || !firstLoopSlot) {
    return [];
  }

  const examples: AgentPromptExample[] = [
    {
      request: '첫 번째 루프 슬롯 입력 모니터링을 켜줘',
      commands: [{ enabled: true, trackId: firstTrack.id, type: AudioCommandType.SET_INPUT_MONITORING }],
    },
  ];
  if (firstLoopSlot.state === 'empty') {
    examples.push({
      request: '첫 번째 루프 슬롯을 2마디 길이로 녹음해줘',
      commands: [
        {
          lengthBars: 2,
          quantizationBars: firstLoopSlot.quantizationBars,
          slotId: firstLoopSlot.id,
          trackId: firstTrack.id,
          type: AudioCommandType.ARM_LOOP_SLOT,
        },
      ],
    });
  } else if (firstLoopSlot.state === 'stopped') {
    examples.push({
      request: '첫 번째 루프 슬롯을 재생해줘',
      commands: [
        {
          slotId: firstLoopSlot.id,
          trackId: firstTrack.id,
          type: AudioCommandType.TRIGGER_LOOP_SLOT,
        },
      ],
    });
  } else if (firstLoopSlot.state === 'playing') {
    examples.push({
      request: '첫 번째 루프 슬롯에 오버더빙해줘',
      commands: [
        {
          slotId: firstLoopSlot.id,
          trackId: firstTrack.id,
          type: AudioCommandType.ARM_LOOP_OVERDUB,
        },
      ],
    });
  }

  return examples;
}

function renderExamples(tracks: readonly AgentPromptTrack[], plugins: readonly AgentPromptPlugin[]): string {
  return [
    ...AGENT_PROMPT_EXAMPLES,
    ...createTargetExamples(tracks),
    ...createPluginExamples(tracks, plugins),
    ...createLoopExamples(tracks),
  ]
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
8. 숫자는 문자열이 아닌 number로 쓴다. 시간은 절대 초다. 사용자 입력의 MM:SS와 HH:MM:SS는 모델 호출 전에 seconds 표현으로 변환된다. 백분율은 100으로 나눠 Track volume과 Master Volume은 0..1, pan은 -1..1로 바꾼다. boolean은 true 또는 false다.
9. 범위를 실제로 내보내려면 SET_EXPORT_RANGE 다음에 EXPORT_AUDIO를 둔다. endTime은 startTime보다 커야 한다.
10. 입력 의존 순서를 유지한다. EXPORT_AUDIO는 해당 묶음의 마지막에 둔다.
11. 편집과 저장을 함께 요청하면 SAVE_PROJECT를 해당 편집 명령 뒤에 둔다.
12. LOAD_PROJECT는 사용자가 Project UUID를 명시했을 때만 사용한다. Project UUID를 임의로 만들지 않고, 다른 명령과 같은 배열에 넣지 않는다.
13. UNDO와 REDO는 사용자가 명시적으로 요청했을 때만 사용한다. UNDO와 REDO는 다른 명령과 같은 배열에 넣지 않는다.
${pluginSafetyRules.text}
${pluginSafetyRules.nextRuleNumber}. Loop Slot 명령은 위 목록에 표시된 trackId와 slotId만 사용한다. 빈 슬롯만 ARM_LOOP_SLOT으로 녹음하고, stopped 슬롯만 TRIGGER_LOOP_SLOT으로 재생하며, playing 슬롯만 ARM_LOOP_OVERDUB으로 오버더빙한다.
${pluginSafetyRules.nextRuleNumber + 1}. SET_AUDIO_INPUT_DEVICE는 사용자가 브라우저 장치 ID 또는 default를 명시했을 때만 사용한다. default는 deviceId=null로 쓴다.
${pluginSafetyRules.nextRuleNumber + 2}. 요청을 안전하게 실행할 정보가 부족하면 []를 반환한다. 지원하지 않는 요청도 []를 반환한다.

# 예시
${renderExamples(projectContext.visibleTracks, pluginContext.visiblePlugins)}
`;
}
