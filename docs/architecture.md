# AudioService 중심 프로젝트 아키텍처 및 의존성

## 목표

이 문서는 `AudioService.ts`를 중심으로 한 오디오 도메인의 **전체 아키텍처**, **의존성 관계**, **데이터 흐름**을 설명합니다. 리팩토링·마이그레이션 결과와 성능·타입 안전성 개선 내용을 반영합니다.

---

## 개요

- **AudioService**: 도메인 모델(Session/Track/Region)과 Tone.js 엔진을 **1:1로 결합**하는 코어 서비스(싱글톤).
- **상태 소스**: UI가 참조하는 상태는 **Zustand Vanilla Store** 한 곳에서만 관리되며, 도메인 모델의 스냅샷(`TrackData[]`)이 Store를 통해 전달됩니다.
- **계층**: Presentation(React, 훅) → Core(AudioService + 도메인) → Logics(순수 유틸)·Infrastructure(Tone, Store).

---

## 1. 계층별 구조

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Presentation Layer (React)                               │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ DawPage     │  │ TrackList  │  │ Cursor      │  │ PlaybackControls    │   │
│  │ TimeRuler   │  │ TrackInfo  │  │ AudioFile   │  │ ExportButton        │   │
│  │             │  │ Sidebar    │  │ Drop        │  │                     │   │
│  └──────┬──────┘  └──────┬─────┘  └──────┬──────┘  └──────────┬──────────┘   │
│         │                │               │                    │              │
│         └────────────────┴───────────────┴────────────────────┘              │
│                                    │                                         │
│                    useAudioService(selector?) ← Zustand useStore             │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼──────────────────────────────────────────┐
│                     Core Layer     │                                          │
│                                    ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  AudioService (Singleton)                                                │  │  │
│  │  ┌─────────────────────────────┐  ┌───────────────────────────────────┐  │  │
│  │  │ Session (Domain)            │  │ Tone.js Engine                     │  │  │
│  │  │  └ Track[]                  │  │  channels: Map<TrackId, Channel>   │  │  │
│  │  │       └ Region[]            │  │  players: Map<TrackId, Map<…>>    │  │  │
│  │  └─────────────────────────────┘  └───────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────┐                                         │  │
│  │  │ store (Zustand Vanilla)      │  ← getSnapshot: tracks, isPlaying, …   │  │
│  │  │  → syncStore() / updateTrack  │                                         │  │
│  │  └─────────────────────────────┘                                         │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                            │
│  │ Session.ts  │  │ Track.ts    │  │ Region.ts   │  (Domain Models)            │
│  └─────────────┘  └─────────────┘  └─────────────┘                            │
└────────────────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼──────────────────────────────────────────┐
│  Logics / Shared                    │  Types / UI Types                         │
│  playerConfig, regionRenderer,      │  audioTypes (AudioSnapshot),              │
│  loadAndDecodeAudioBuffer,          │  track (RegionData, TrackData 상속 관계)   │
│  audioEngine.errors                 │  statusTypes (TrackStatus, RegionStatus)  │
│  wavConverter (ExportButton/utils)  │                                            │
└────────────────────────────────────┴──────────────────────────────────────────┘
```

---

## 2. AudioService.ts 의존성 상세

### 2.1 AudioService가 의존하는 모듈 (Inbound)

| 의존 대상 | 경로 | 용도 |
|-----------|------|------|
| **Tone** | `tone` | Transport 제어(play/pause/stop/setTime), Channel/Player 생성, Offline 렌더링, gainToDb |
| **Zustand** | `zustand/vanilla` | `createStore<AudioSnapshot>` — 단일 상태 저장소 |
| **Session** | `../session/Session` | 프로젝트 루트, Track 보유 |
| **Track / TrackData** | `../track/Track` | 도메인 트랙 및 스냅샷 타입 |
| **Region** | `../region/Region` | 도메인 리전, addRegion 시 생성 |
| **AudioSnapshot** | `@/types/audioTypes` | Store 상태 타입 |
| **playerConfig** | `@/logics/audio/playerConfig` | PLAYER_CONFIG, configurePlayerLoop, startPlayer |
| **RegionRenderer** | `@/logics/audio/regionRenderer` | Export 시 렌더 파라미터 계산·범위 조정 |
| **loadAndDecodeAudioBuffer** | `@/logics/audio/loadAndDecodeAudioBuffer` | Export 전 버퍼 프리로드 |
| **AudioEngineError(Code)** | `@/logics/audio/audioEngine.errors` | Export 실패 등 에러 분류 |
| **wavConverter** | `@/components/…/ExportButton/utils/wavConverter` | AudioBuffer → WAV Blob 변환 |

### 2.2 AudioService를 사용하는 모듈 (Outbound)

| 소비자 | 경로 | 사용 방식 |
|--------|------|-----------|
| **App** | `src/App.tsx` | `AudioService.initialize(session)` — 앱 기동 시 1회 |
| **useAudioService** | `src/presentation/hooks/useAudioService.ts` | `getInstance().store` + selector로 React 연결 |
| **AudioFileDrop** | `src/components/common/FileDrop/AudioFileDrop.tsx` | `getInstance().addRegion(...)` — 파일 드롭 시 리전 추가 |
| **useAudioCommand** | `src/logics/audio/useAudioCommand.ts` | play/pause/stop/setTime/setTrackVolume/setTrackPan, addRegion/removeRegion, setExportRange, exportProject |
| **useTrackActions** | `src/components/Daw/hooks/useTrackActions.ts` | `getInstance().splitRegion(trackId, splitTime)` |
| **PlaybackControls** | `src/components/Daw/components/PlaybackControls/PlaybackControls.tsx` | `useAudioService(state => state.isPlaying)` |
| **Cursor** | `src/components/Daw/components/Cursor/Cursor.tsx` | `useAudioService()` + `getInstance().getCurrentTime()` |
| **DawPage** | `src/components/Daw/DawPage.tsx` | `useAudioService(state => state.tracks.length)` |
| **TrackList** | `src/components/Daw/components/TrackList.tsx` | `useAudioService(state => state.tracks)` |
| **TrackInfoSidebar** | `src/components/Daw/components/TrackInfoSidebar.tsx` | `useAudioService(state => state.tracks)` |
| **TimeRuler** | `src/components/Daw/components/TimeRuler/TimeRuler.tsx` | `useAudioService(useShallow(selector))` |
| **ExportButton** | `src/components/Daw/components/ExportButton/ExportButton.tsx` | `useAudioCommand().execute(EXPORT_AUDIO)` → 내부에서 `service.exportProject()` |

---

## 3. 도메인 모델과 타입 (SSOT)

### 3.1 단일 진실 공급원(SSOT)

- **도메인 클래스**가 필수 필드를 갖고, **UI용 타입**은 도메인에서 파생됩니다.
- `TrackData`, `RegionData`는 도메인 모델의 `toSnapshot()` 결과 타입과 맞추어, UI는 이 스냅샷만 구독합니다.

```
Region (core/region/Region.ts)
  → RegionData (interface), toSnapshot(): RegionData

Track (core/track/Track.ts)
  → TrackData extends Required<TrackProps> { regions: RegionData[] }
  → toSnapshot(): TrackData

AudioSnapshot (types/audioTypes.ts)
  → tracks: TrackData[]
  → isPlaying, currentTime, tempo, exportStartTime, exportEndTime
```

### 3.2 Region 생성 시점과 duration

- **버그 수정 반영**: Region은 `player.onload` 이후에 생성됩니다.
- `duration`은 `regionData.duration ?? player.buffer.duration`으로 결정되므로, 오디오 길이 누락 없이 도메인 리전이 만들어집니다.

### 3.3 상태 통일 (isMuted, isSoloed)

- `Track`에서는 `status: TrackStatus[]`로 관리하고, `TRACK_STATUS.MUTED`, `TRACK_STATUS.SOLOED`를 사용합니다.
- `isMuted` / `isSoloed` getter/setter는 이 `status` 배열을 기반으로 동작합니다.

---

## 4. 데이터 흐름 (대표 시나리오)

### 4.1 앱 부팅 → AudioService 준비

```
App.tsx useEffect
  → new Session()
  → AudioService.initialize(session)
  → AudioService.instance = new AudioService(session)
  → isAudioEngineReady = true → 라우터/DAW UI 렌더
```

### 4.2 오디오 파일 드롭 → 트랙/리전 표시

```
AudioFileDrop.onFileDrop
  → convertFileToAudioFile(file) → addAudioFile (useAudioFileStore)
  → AudioService.getInstance().addRegion(trackId, { id, url, startTime, sourceStartTime, duration, audioFile })
  → session.getTrack(trackId) || session.addTrack(new Track(...))
  → getOrInitChannel(trackId) → Tone.Channel
  → new Tone.Player({ url, onload, ... }).connect(channel)
  → onload:
       duration = regionData.duration ?? player.buffer.duration
       region = new Region({ ..., duration, status: [] })
       track.addRegion(region)
       configurePlayerLoop, startPlayer
       syncStore()  → store.setState({ tracks: session.tracks.map(t => t.toSnapshot()) })
  → useAudioService 구독자 리렌더 → TrackList 등에 새 트랙/리전 표시
```

### 4.3 재생 / 정지 / 시간 설정

```
PlaybackControls / Cursor / 키보드 등
  → useAudioCommand().execute(PLAY | PAUSE | STOP | SET_CURRENT_TIME)
  → AudioService.getInstance().play() | pause() | stop() | setTime(time)
  → Tone.Transport + store.setState({ isPlaying, currentTime })
  → useAudioService(state => state.isPlaying | state.currentTime) 리렌더
```

### 4.4 볼륨/팬 변경 (Partial Update)

```
UI (트랙 헤더 등)
  → AudioService.setTrackVolume(trackId, volume) | setTrackPan(trackId, pan)
  → 1) 도메인: track.volume = volume (또는 pan)
  → 2) 엔진: channel.volume.rampTo(...) | channel.pan.rampTo(...)
  → 3) UI: updateTrackState(trackId, { volume }) → store.setState(tracks만 부분 갱신)
```

- `updateTrackState`로 해당 트랙 필드만 갱신하므로, 불필요한 전체 스냅샷 재생성과 리렌더를 줄입니다.

### 4.5 리전 스플릿

```
useTrackActions().splitRegion(trackId, splitTime)
  → AudioService.splitRegion(trackId, splitTime)
  → track.getRegion at splitTime → region.split(splitTime) → left, right (도메인)
  → track.removeRegion(region.id); track.addRegion(left); track.addRegion(right)
  → removeRegion(기존 Player 정리) → addRegion(left), addRegion(right) (엔진 재생성)
  → syncStore()
```

### 4.6 Export

```
ExportButton → useAudioCommand().execute(EXPORT_AUDIO)
  → AudioService.getInstance().exportProject()
  → store.getState().tracks, exportStartTime/exportEndTime (또는 options)
  → preloadAudioBuffers(tracks) → loadAndDecodeAudioBuffer
  → getTotalDuration / options.range
  → Tone.Offline(...) 내부에서 RegionRenderer.calculateRenderParams / adjustForExportRange, configurePlayerLoop, startPlayer
  → renderedBuffer.get() → audioBufferToWav(audioBuffer) → Blob
  → downloadBlob(blob, filename)
```

- Export 로직이 현재는 `AudioService` 내부에 약 100줄 이상 있습니다. 추후 **AudioExporter 클래스**로 분리하면 AudioService 책임이 더 경량화됩니다.

---

## 5. 리팩토링 및 타입 안전성 반영 사항

| 항목 | 설명 |
|------|------|
| **Partial Update** | 볼륨/팬 변경 시 `updateTrackState(trackId, updates)`로 해당 트랙만 Store 갱신. 중복 제거 및 가독성·유지보수성 향상. |
| **도메인 필수값** | Region/Track에서 `duration`, `status` 등 필수값을 생성자·타입으로 강제. |
| **SSOT** | UI 타입(`TrackData`, `RegionData`)이 도메인 모델의 `toSnapshot()` 결과를 그대로 사용하도록 구조 정리. |
| **상태 통일** | isMuted, isSoloed를 `TrackStatus` 상수 배열로 통일. |
| **Region 생성 시점** | `player.onload` 이후 Region 생성으로 duration 누락 버그 제거. |
| **Export 분리 (권장)** | 현재 exportProject는 AudioService 내부에 있음. 별도 `AudioExporter` 클래스로 분리 시 서비스 경량화 가능. |

---

## 6. 성능 관련

- **Selector 패턴**: `useAudioService(selector)`로 필요한 상태만 구독 (예: `state => state.tracks`, `state => state.isPlaying`). Zustand의 selector로 불필요한 리렌더 감소.
- **useShallow**: TimeRuler 등에서 `useAudioService(useShallow(...))` 사용 시 참조 안정성 유지하면서 얕은 비교로 리렌더 제어.
- **syncStore vs updateTrackState**: 전체 `tracks` 갱신이 필요할 때만 `syncStore()`, 볼륨/팬은 `updateTrackState`로 부분 갱신.
- **React.memo**: TrackComponent 등 리스트 자식에 메모이제이션 적용 시 트랙 수가 많아져도 리렌더 범위 축소.

---

## 7. 에러 처리

- Export 실패 등은 `AudioEngineError` + `AudioEngineErrorCode`로 구분됩니다.
- `EXPORT_NO_TRACKS`, `EXPORT_ZERO_DURATION`, `RENDER_FAILED` 등은 UI에서 메시지 매핑(`ERROR_MESSAGES`) 후 사용자에게 노출할 수 있습니다.

---

## 8. 요약

- **AudioService**는 Session(도메인)과 Tone.js(엔진)를 결합하고, Zustand Store 하나로 UI에 스냅샷을 공급하는 **단일 진실 공급원**입니다.
- **의존성**: Core(Region, Track, Session), Logics(playerConfig, regionRenderer, loadAndDecodeAudioBuffer, audioEngine.errors), ExportButton 쪽 wavConverter를 사용하며, React 쪽은 **useAudioService**와 **useAudioCommand**·**useTrackActions**를 통해서만 AudioService에 접근합니다.
- **데이터 흐름**은 단방향: 사용자/에이전트 액션 → AudioService 메서드 → 도메인·엔진 갱신 → Store 갱신 → useAudioService 구독자 리렌더.
- 리팩토링으로 **Partial Update**, **도메인 필수값·SSOT·상태 통일**, **Region duration 버그 수정**이 반영되어 있으며, Export 로직을 AudioExporter로 분리하면 AudioService의 책임이 더 줄어듭니다.
