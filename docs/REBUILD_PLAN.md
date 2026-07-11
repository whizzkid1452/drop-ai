좋아. 이 리포 기준으로는 **“단일 리포 + 현재 `layers` 구조 유지 + Command/PluginHost를 끼워 넣는 방식”**이 제일 좋습니다.

지금 베이스로 삼기 좋은 축은 이미 있어요: [create-app.ts](/Users/hurraey/code/whizzkid/drop-ai/src/layers/apps/create-app.ts:13), [discipline.md](/Users/hurraey/code/whizzkid/drop-ai/src/layers/discipline.md:3), [LayerContext.tsx](/Users/hurraey/code/whizzkid/drop-ai/src/layers/apps/web/context/LayerContext.tsx:20), [session.ts](/Users/hurraey/code/whizzkid/drop-ai/src/layers/session/session.ts:22), [i-audio-engine.ts](/Users/hurraey/code/whizzkid/drop-ai/src/layers/audio-engine/i-audio-engine.ts:3), [DawPage.tsx](/Users/hurraey/code/whizzkid/drop-ai/src/layers/apps/web/components/Daw/DawPage.tsx:11)

**전체 방향**

- monorepo로 바로 쪼개지 말고, 먼저 이 리포 안에서 구조를 증명

- 타임라인보다 **코어/플러그인/에이전트 경계**를 먼저 만든다

- 사람, UI, Agent가 모두 **같은 Command 경로**를 쓰게 만든다

- 플러그인은 `manifest + sdk + host`로만 붙는다

---

**Phase 0. 리빌드 베이스 정리**

목표: 현재 리포를 “Agent DAW + Plugin Platform” 실험장으로 정리

작업

- `/` 진입 화면은 `DropPage`로 유지하고, DAW 작업 화면은 `/daw`의 `DawPage`에서 이어간다. `cli-test`는 내부 테스트용으로 유지

- `src/layers/commands`, `src/layers/plugin-host`, `src/layers/apps/agent`, `src/layers/plugins` 디렉토리 추가

- `docs/REBUILD_PLAN.md`의 파일명, 라우팅, 레이어 기준을 현재 리포 구조와 맞춘다

- `createApp()` 조립 구조에 앞으로 `pluginHost`, `commandExecutor`가 들어갈 자리 확보

종료 조건

- `/`에서는 기존 업로드/진입 화면이 뜨고, `/daw`에서 DAW 화면이 뜬다

- 새 레이어 폴더가 생기고, 의존 방향이 문서화돼 있다

---

**Phase 1. Command 중심 코어 만들기**

목표: 기존 controller 중심 구조 위에 **Command Facade**를 얹는다

작업

- `CommandType`, `CommandPayload`, `CommandExecutor` 추가

- 최소 command부터:

  - `ADD_TRACK`

  - `INSTALL_PLUGIN`

  - `REMOVE_PLUGIN`

  - `SET_PLUGIN_PARAMETER`

- `zod`로 command payload 검증

- `TrackController`, `PlaybackController`는 점진적으로 `CommandExecutor`를 사용하도록 변경

- `AppController`는 외부에 보여주는 최상위 Facade 유지

주요 변경 파일

- [session.ts](/Users/hurraey/code/whizzkid/drop-ai/src/layers/session/session.ts:22)

- [index.ts](/Users/hurraey/code/whizzkid/drop-ai/src/layers/controllers/index.ts:9)

- 새 `src/layers/commands/`*

종료 조건

- UI 없이도 command만으로 track 생성/플러그인 설치/파라미터 변경 가능

- unit test로 command 검증 가능

---

**Phase 2. Plugin 상태 모델 추가**

목표: 세션이 “트랙/리전 저장소”에서 “플러그인 인스턴스까지 포함한 상태 저장소”로 확장

작업

- `TrackState`에 `pluginInstances` 추가

- `PluginInstanceState`, `PluginParameterState`, `PluginLogEntry` 타입 추가

- 플러그인 활성 상태, manifest 요약, validation 상태 저장

- `useSession`은 여전히 읽기 전용 유지

예시 상태

- `tracks[].pluginInstances[]`

- `pluginCatalog`

- `pluginLogs`

- `validationResults`

종료 조건

- session snapshot만 봐도 “어떤 트랙에 어떤 플러그인이 있고, 파라미터가 얼마인지” 알 수 있다

---

**Phase 3. Plugin Manifest + Plugin Host**

목표: 플러그인 규격을 선언형으로 제한한다

작업

- `manifest` 스키마 정의

- `PluginHost` 구현:

  - manifest validate

  - registry 등록

  - install / activate / dispose

  - 로그 수집

- `Plugin SDK` 타입 정의:

  - `parameters.get/set`

  - `log.info/error`

  - `audio.registerProcessor`

  - `ui.controls`

추천 디렉토리

- `src/layers/plugin-host/`

- `src/layers/plugin-sdk/`

- `src/layers/plugins/builtin/`

종료 조건

- 내장 플러그인 1개를 manifest로 등록할 수 있다

- 플러그인이 코어 객체를 직접 import하지 않는다

---

**Phase 4. Audio Engine에 Plugin Chain 붙이기**

목표: 플러그인이 실제 오디오에 영향을 준다

작업

- `IAudioEngine` 확장:

  - `installPlugin(trackId, manifestId)`

  - `removePlugin(trackId, instanceId)`

  - `setPluginParameter(trackId, instanceId, parameterId, value)`

- 현재 `TrackNodes`를 `input -> plugins[] -> channel -> destination` 구조로 개편

- 첫 플러그인은 `Gain`, 두 번째는 `Saturation`

- 시작은 Tone 기반 노드로 빠르게 붙이고, 다음 phase에서 Worklet로 올려도 됨

주요 파일

- [audio-engine.ts](/Users/hurraey/code/whizzkid/drop-ai/src/layers/audio-engine/audio-engine.ts:1)

- [i-audio-engine.ts](/Users/hurraey/code/whizzkid/drop-ai/src/layers/audio-engine/i-audio-engine.ts:3)

종료 조건

- 트랙에 Gain/Saturation 설치 후 소리가 실제로 바뀐다

---

**Phase 5. Template UI + Dev Center**

목표: 플러그인 UI를 Host가 렌더링하고, 플랫폼처럼 보이게 만든다

작업

- `DawPage`를 3영역으로 정리

  - 왼쪽: Track List

  - 가운데: Timeline placeholder 유지

  - 오른쪽: Plugin Inspector + Dev Center

- manifest 기반 control renderer 추가

  - `slider`

  - `toggle`

  - `select`

- Dev Center 기능

  - plugin catalog

  - validation result

  - install/remove

  - 실시간 로그

주요 파일

- [DawPage.tsx](/Users/hurraey/code/whizzkid/drop-ai/src/layers/apps/web/components/Daw/DawPage.tsx:11)

- `src/layers/apps/web/ui/components/`*

종료 조건

- 플러그인 UI를 플러그인 코드가 직접 렌더링하지 않고, Host가 manifest만 보고 그린다

- “플러그인 플랫폼”처럼 데모 가능하다

---

**Phase 6. Agent 레이어 추가**

목표: 사람과 AI가 같은 인터페이스를 쓰게 한다

작업

- `src/layers/apps/agent/` 추가

- tool 4개만 먼저:

  - `daw_query`

  - `daw_command`

  - `plugin_query`

  - `plugin_set_parameter`

- Agent는 세션 상태 조회 후 `CommandExecutor`만 호출

- 웹 UI에 간단한 chat/command trace panel 추가

종료 조건

- “보컬 트랙에 saturation 걸어줘”, “drive 0.4로 줄여줘” 같은 명령이 동작

- Agent가 session/audio-engine 직접 접근하지 않는다

---

**Phase 7. 테스트/하드닝/포폴 마감**

목표: 데모가 흔들리지 않게 만든다

작업

- unit test

  - command validation

  - manifest validation

  - install/remove

  - parameter update

- e2e

  - track 생성

  - plugin 설치

  - parameter 조작

  - agent로 plugin 변경

  - dev center 로그 표시

- 에러 경계/빈 상태/로딩 상태 정리

- 포폴용 스크린샷 3장 확보

종료 조건

- “웹에서 track 생성 → plugin 설치 → AI로 parameter 변경” 데모가 안정적으로 된다

---

**권장 구현 순서 요약**

1. 진입 흐름/폴더 정리  

2. CommandExecutor  

3. Session plugin state  

4. PluginHost/Manifest  

5. Audio plugin chain  

6. Web UI/Dev Center  

7. Agent  

8. 테스트/문서

**이 리포에서 특히 좋은 점**

- `createApp()`이 이미 조립 지점이라 Host/Agent 붙이기 좋음

- `discipline.md` 규칙이 토스플레이스식 “코어 보호”와 결이 맞음

- UI가 아직 얕아서, 지금 구조를 토스플레이스 맞춤으로 다시 세우기 쉬움

원하면 다음엔 이 플랜을 바로 이어서 **폴더 트리 + 파일 생성안 + Phase 1 작업 체크리스트**로 더 구체화해줄게.
