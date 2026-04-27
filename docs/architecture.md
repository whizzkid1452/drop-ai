# drop-ai 아키텍처 분석 문서

## 목차

1. [전체 구조 개요](#1-전체-구조-개요)
2. [레이어 아키텍처 다이어그램](#2-레이어-아키텍처-다이어그램)
3. [IAudioEngine — 추상화에 의존](#3-iaudioengine--추상화에-의존)
4. [Facade 패턴 — AppController](#4-facade-패턴--appcontroller)
5. [생성자 주입 패턴 (Constructor Injection)](#5-생성자-주입-패턴-constructor-injection)
6. [Class 기반 Controller 캡슐화](#6-class-기반-controller-캡슐화)
7. [createApp — Composition Root](#7-createapp--composition-root)
8. [Vanilla Zustand — React 비의존 상태 관리](#8-vanilla-zustand--react-비의존-상태-관리)
9. [의존성 주입 관계도](#9-의존성-주입-관계도)
10. [데이터 플로우](#10-데이터-플로우)
11. [React 연결 브릿지 — LayerContext](#11-react-연결-브릿지--layercontext)
12. [설계 원칙 요약](#12-설계-원칙-요약)

---

## 1. 전체 구조 개요

drop-ai는 Web DAW(Digital Audio Workstation) 애플리케이션으로, **UI · 비즈니스 로직 · 오디오 엔진 · 상태관리** 를 명확하게 분리한 레이어드 아키텍처를 채택하고 있다.

```
src/
├── App.tsx                          ← React 진입점, AudioEngine 생성
├── main.tsx
├── layers/
│   ├── audio-engine/
│   │   ├── i-audio-engine.ts        ← 인터페이스 (추상화 계층)
│   │   └── audio-engine.ts          ← Tone.js 구현체
│   ├── controllers/
│   │   ├── index.ts                 ← AppController (Facade)
│   │   ├── playback-controller.ts   ← 재생 제어
│   │   └── track-controller.ts      ← 트랙/리전 제어
│   ├── session/
│   │   └── session.ts               ← Zustand Vanilla Store
│   └── apps/
│       ├── create-app.ts            ← Composition Root
│       ├── context/
│       │   └── LayerContext.tsx     ← React 연결 브릿지
│       ├── web/                     ← Web UI 레이어
│       └── cli/                     ← CLI 레이어
└── components/                      ← 공통 React 컴포넌트
```

---

## 2. 레이어 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                             │
│              (React Components / CLI)                        │
│                                                             │
│   useController()  ──────────────────────►  AppController  │
│   useSession(sel)  ◄──────────────────────  SessionStore   │
└─────────────────────────┬───────────────────────────────────┘
                          │ 의존성 주입 (constructor)
┌─────────────────────────▼───────────────────────────────────┐
│                   Controller Layer                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               AppController (Facade)                 │   │
│  │                                                     │   │
│  │   playback: PlaybackController                      │   │
│  │   track:    TrackController                         │   │
│  │   session:  SessionStore        (public readonly)   │   │
│  │   engine:   IAudioEngine        (private)           │   │
│  └──────────┬───────────────────────────────┬──────────┘   │
└─────────────┼───────────────────────────────┼──────────────┘
              │                               │
    ┌─────────▼──────────┐       ┌────────────▼──────────┐
    │   Audio Engine     │       │    Session Store       │
    │   Layer            │       │    Layer               │
    │                    │       │                        │
    │  <<interface>>     │       │  Zustand Vanilla       │
    │  IAudioEngine      │       │  createStore()         │
    │       ▲            │       │                        │
    │       │ implements │       │  SessionData           │
    │  AudioEngine       │       │  SessionActions        │
    │  (Tone.js)         │       │                        │
    └────────────────────┘       └────────────────────────┘
```

**핵심 원칙:** UI는 Controller를 통해서만 명령을 내리고, Controller는 AudioEngine과 SessionStore를 모두 조율한다. UI가 AudioEngine을 직접 건드리지 못한다.

---

## 3. IAudioEngine — 추상화에 의존

### 인터페이스 정의 (`i-audio-engine.ts`)

```typescript
export interface IAudioEngine {
  // 재생 제어
  play(): Promise<void>;
  stop(): void;
  pause(): void;
  seekTo(time: number): void;
  getCurrentTime(): number;
  setVolume(value: number): void;

  // 파일 로딩
  loadFile(file: File): Promise<{ src: string; duration: number }>;

  // 트랙 관리
  createTrack(id: string): void;
  removeTrack(id: string): void;
  setTrackVolume(id: string, volume: number): void;
  setTrackMute(id: string, muted: boolean): void;
  setTrackSolo(id: string, soloed: boolean): void;
  setTrackPan(id: string, pan: number): void;

  // 리전(클립) 관리
  addRegion(trackId: string, region: RegionState): void;
  removeRegion(trackId: string, regionId: string): void;
  moveRegion(trackId: string, regionId: string, newStartTime: number): void;

  // 루프 / BPM
  setLoop(loop: boolean): void;
  setLoopPoints(start: number, end: number): void;
  setBpm(bpm: number): void;

  // 유틸
  getDebugInfo(): string;
  exportSession(duration: number, tracks: Map<...>): Promise<Blob>;
}
```

### 왜 인터페이스에 의존하는가?

```
Controller가 직접 Tone.js에 의존할 경우:

  PlaybackController ──► Tone.js (강결합)
         │
         └─ Tone.js 교체 시 Controller 코드 전체 수정 필요
         └─ 테스트 시 Tone.js 실제 로드 강제

Controller가 IAudioEngine 인터페이스에 의존할 경우:

  PlaybackController ──► IAudioEngine (약결합)
                              ▲
                    ┌─────────┴──────────┐
                    │                    │
              AudioEngine         MockAudioEngine
              (Tone.js)           (테스트용)
```

**의존성 역전 원칙(DIP):** Controller는 구체 클래스가 아닌 추상화(interface)에 의존한다. 구체 구현체(Tone.js)는 바깥에서 주입된다.

---

## 4. Facade 패턴 — AppController

### 구조

```typescript
// src/layers/controllers/index.ts
export class AppController {
  public readonly playback: PlaybackController;  // 재생 관련 기능
  public readonly track: TrackController;        // 트랙 관련 기능
  public readonly session: SessionStore;         // 상태 읽기용
  private readonly audioEngine: IAudioEngine;    // 직접 접근 차단

  constructor(sessionStore: SessionStore, audioEngine: IAudioEngine) {
    this.session = sessionStore;
    this.audioEngine = audioEngine;
    this.playback = new PlaybackController(sessionStore, audioEngine);
    this.track = new TrackController(sessionStore, audioEngine);
  }
}
```

### Facade 패턴이 해결하는 문제

```
Facade 없을 때 (UI가 직접 접근):

  UI ──► PlaybackController
  UI ──► TrackController
  UI ──► AudioEngine          ← 직접 접근 위험
  UI ──► SessionStore         ← 일관성 없는 조작 가능

Facade 적용 후 (단일 진입점):

  UI ──► AppController
            ├── .playback.handlePlay()
            ├── .playback.handleStop()
            ├── .track.addTrack()
            └── .track.addRegion()
                    (내부에서 AudioEngine + SessionStore 조율)
```

**효과:**
- UI는 `controller.playback.handlePlay()` 처럼 의도가 명확한 API만 사용
- `audioEngine`은 `private` 멤버라 외부에서 직접 호출 불가
- 하위 컨트롤러가 추가되어도 UI 코드 변경 없음

---

## 5. 생성자 주입 패턴 (Constructor Injection)

### 각 클래스의 생성자

```typescript
// PlaybackController
constructor(
  private sessionStore: SessionStore,   // ← 외부에서 주입
  private audioEngine: IAudioEngine     // ← 외부에서 주입
) {}

// TrackController
constructor(
  private sessionStore: SessionStore,
  private audioEngine: IAudioEngine
) {}

// AppController
constructor(sessionStore: SessionStore, audioEngine: IAudioEngine) {
  this.playback = new PlaybackController(sessionStore, audioEngine); // 하위 컨트롤러에도 전달
  this.track = new TrackController(sessionStore, audioEngine);
}
```

### 주입 흐름

```
createApp(audioEngine)           ← 외부에서 AudioEngine 주입
    │
    ├─ createSessionStore()      ← 내부에서 SessionStore 생성
    │
    └─ new AppController(session, audioEngine)
              │
              ├─ new PlaybackController(session, audioEngine)
              └─ new TrackController(session, audioEngine)
```

### 테스트에서의 이점

```typescript
// 실제 코드
const engine = new AudioEngine();           // Tone.js 사용
const app = createApp(engine);

// 테스트 코드
const mockEngine: IAudioEngine = {
  play: vi.fn(),
  stop: vi.fn(),
  // ... 목업
};
const app = createApp(mockEngine);          // 동일한 인터페이스로 교체
```

**같은 `createApp` 함수를 사용하면서도 구현체만 바꾼다.** Tone.js가 실제로 로드되지 않아 빠르고 격리된 단위 테스트가 가능하다.

---

## 6. Class 기반 Controller 캡슐화

### PlaybackController

```typescript
export class PlaybackController {
  // 각 메서드는 항상 두 단계로 구성:
  // 1. AudioEngine 명령
  // 2. SessionStore 상태 갱신

  async handlePlay(): Promise<void> {
    await this.audioEngine.play();                    // Step 1: 실제 오디오 재생
    this.sessionStore.getState().setPlaying(true);    // Step 2: UI 상태 반영
  }

  handleBpm(bpm: number): void {
    this.audioEngine.setBpm(bpm);                     // Step 1: Tone.js Transport BPM
    this.sessionStore.getState().setBpm(bpm);         // Step 2: UI 상태 반영
  }
}
```

### TrackController

```typescript
export class TrackController {
  async addRegion(trackId: string, file: File, startTime: number) {
    const { src, duration } = await this.audioEngine.loadFile(file); // Step 1: 파일 로드
    const region = { id: crypto.randomUUID(), src, startTime, duration, offset: 0, trackId };
    this.audioEngine.addRegion(trackId, region);                     // Step 2: 엔진에 등록
    this.sessionStore.getState().addRegion(trackId, region);         // Step 3: 상태 갱신
    return { regionId: region.id };
  }

  splitRegion(trackId: string, regionId: string, splitTime: number) {
    // 세션에서 현재 리전 정보 조회
    const region = this.sessionStore.getState().tracks.get(trackId)
                       ?.regions.find(r => r.id === regionId);

    // 좌/우 분할 계산 (순수 로직)
    const leftDuration = splitTime - region.startTime;
    const rightRegion = { ...region, id: crypto.randomUUID(),
                          startTime: splitTime, offset: region.offset + leftDuration };

    // 엔진 + 스토어 동시 갱신
    this.resizeRegion(trackId, regionId, leftDuration);
    this.audioEngine.addRegion(trackId, rightRegion);
    this.sessionStore.getState().addRegion(trackId, rightRegion);
  }
}
```

### 클래스를 선택한 이유

| 요인 | 이유 |
|------|------|
| **상태 보유** | `sessionStore`, `audioEngine` 을 생성 시 한 번만 주입받아 내부에 보관 → 매 메서드 호출마다 전달 불필요 |
| **캡슐화** | `audioEngine`을 `private`으로 선언해 외부 직접 변경 차단 |
| **그룹화** | `playback.*`, `track.*` 처럼 유스케이스별 네임스페이스 역할 |
| **테스트** | 인스턴스 단위로 격리 테스트 가능 |

---

## 7. createApp — Composition Root

```typescript
// src/layers/apps/create-app.ts

export interface AppInstance {
  session: SessionStore;
  controller: AppController;
}

export function createApp(audioEngine: IAudioEngine): AppInstance {
  const session = createSessionStore();             // 1. 상태 레이어 생성
  const controller = new AppController(session, audioEngine); // 2. 컨트롤러 조립
  return { session, controller };                   // 3. AppInstance 반환
}
```

### Composition Root란?

> 모든 의존성 생성과 연결이 **단 한 곳**에서 이뤄지는 진입점.

```
createApp() 이전:                   createApp() 이후:

  ?  SessionStore                    ┌─ AppInstance ─────────────┐
  ?  AppController                   │  session: SessionStore     │
  ?  PlaybackController              │  controller: AppController │
  ?  TrackController                 │    ├─ playback            │
                                     │    └─ track               │
                                     └───────────────────────────┘
```

**왜 별도 파일로 분리했는가?**
- 의존성 구성 코드와 비즈니스 로직 코드를 분리
- 전체 앱의 의존성 그래프를 한 눈에 파악 가능
- `AudioEngine`만 외부에서 주입받고, 나머지는 내부에서 생성 → 테스트 시 엔진만 교체

### 사용 위치 (LayerContext)

```typescript
// LayerContext.tsx
const value = useMemo(() => createApp(engine), [engine]);
//            ↑ engine이 바뀔 때만 재조립, 이후 메모이제이션
```

---

## 8. Vanilla Zustand — React 비의존 상태 관리

### React 훅 vs Vanilla Store 차이

```typescript
// ❌ React 전용 (컴포넌트 외부에서 사용 불가)
const useSessionStore = create<SessionState>(...);
const state = useSessionStore.getState();  // React 훅 의존

// ✅ Vanilla (어디서든 사용 가능)
import { createStore } from 'zustand/vanilla';
const store = createStore<SessionState>(...);
const state = store.getState();            // 순수 JS 객체, React 불필요
```

### 스토어 구조

```typescript
// SessionData (읽기 전용 상태값)
interface SessionData {
  isPlaying: boolean;
  masterVolume: number;      // 0.0 ~ 1.0
  bpm: number;               // 템포
  isLooping: boolean;
  loopStart: number;         // 초 단위
  loopEnd: number;
  tracks: Map<string, TrackState>;  // id 기반 O(1) 접근
}

// SessionActions (상태 변경 함수)
interface SessionActions {
  setPlaying(playing: boolean): void;
  addTrack(track: TrackState): void;
  updateTrack(id: string, updates: Partial<TrackState>): void;
  removeTrack(id: string): void;
  addRegion(trackId: string, region: RegionState): void;
  updateRegion(trackId: string, regionId: string, updates: Partial<RegionState>): void;
  removeRegion(trackId: string, regionId: string): void;
  // ...
}
```

### 불변 업데이트 패턴

```typescript
// Map은 참조 타입이므로 반드시 복사 후 수정
addTrack: track =>
  set(state => {
    const newTracks = new Map(state.tracks); // 기존 Map 복사
    newTracks.set(track.id, track);          // 새 항목 추가
    return { tracks: newTracks };            // 새 참조 반환 → 리렌더 트리거
  }),

// 중첩 불변 업데이트 (Track 내 Region)
addRegion: (trackId, region) =>
  set(state => {
    const track = state.tracks.get(trackId);
    if (!track) return state;                          // 가드
    const newRegions = [...track.regions, region];     // 배열 복사
    const newTrack = { ...track, regions: newRegions }; // 트랙 복사
    const newTracks = new Map(state.tracks);            // Map 복사
    newTracks.set(trackId, newTrack);
    return { tracks: newTracks };
  }),
```

### Map을 사용하는 이유

```
Array 방식:                          Map 방식:
tracks.find(t => t.id === id)        tracks.get(id)
→ O(n) 선형 탐색                    → O(1) 해시 조회

100개 트랙에서 하나 수정:
  Array: 최대 100번 비교             Map: 1번 조회
```

---

## 9. 의존성 주입 관계도

```
                    ┌──────────────┐
                    │   App.tsx    │
                    │              │
                    │  new         │
                    │  AudioEngine │ ← Tone.js 구현체 생성 (최상위)
                    └──────┬───────┘
                           │ engine prop
                    ┌──────▼───────┐
                    │LayerProvider │
                    │              │
                    │  createApp(  │
                    │    engine)   │ ← Composition Root 호출
                    └──────┬───────┘
                           │
              ┌────────────▼────────────────┐
              │         createApp()          │
              │                             │
              │  createSessionStore()        │ ← SessionStore 생성
              │  new AppController(          │
              │    session, engine)          │ ← 의존성 전달
              └────────────┬────────────────┘
                           │
              ┌────────────▼────────────────┐
              │       AppController          │
              │                             │
              │  session = sessionStore      │ (public readonly)
              │  engine  = audioEngine       │ (private)
              │                             │
              │  new PlaybackController(     │
              │    session, engine)          │
              │  new TrackController(        │
              │    session, engine)          │
              └─────────────────────────────┘
                     │               │
        ┌────────────▼──┐    ┌───────▼───────────┐
        │PlaybackCtrl   │    │  TrackController   │
        │               │    │                   │
        │ sessionStore  │    │  sessionStore      │ ← 동일 인스턴스 공유
        │ audioEngine   │    │  audioEngine       │ ← 동일 인스턴스 공유
        └───────────────┘    └───────────────────┘
```

**인스턴스 공유 보장:**
`AppController`가 생성하는 두 하위 컨트롤러는 동일한 `sessionStore`와 `audioEngine` 인스턴스를 참조한다. 상태 불일치가 발생하지 않는다.

---

## 10. 데이터 플로우

### 재생 버튼 클릭 흐름

```
Transport UI (React)
    │
    │ onClick
    ▼
controller.playback.handlePlay()
    │
    ├─ 1. await audioEngine.play()
    │          │
    │          ▼
    │      Tone.getTransport().start()
    │      (실제 오디오 출력)
    │
    └─ 2. sessionStore.getState().setPlaying(true)
               │
               ▼
           Zustand set({ isPlaying: true })
               │
               ▼
           구독 중인 컴포넌트 리렌더
           (useSession(s => s.isPlaying))
               │
               ▼
           Transport 버튼 상태 변경 (Play → Pause)
```

### 트랙 추가 + 파일 드롭 흐름

```
TrackList UI
    │
    │ "Add Track" 클릭
    ▼
controller.track.addTrack()
    │
    ├─ id = crypto.randomUUID()
    ├─ audioEngine.createTrack(id)   → Tone.Channel 생성
    └─ sessionStore.addTrack({...})  → Map에 트랙 추가
                                            │
                                            ▼
                                   UI 리렌더: 트랙 행 표시

    │
    │ 파일 드롭
    ▼
controller.track.addRegion(trackId, file, startTime)
    │
    ├─ 1. {src, duration} = await audioEngine.loadFile(file)
    │          │
    │          └─ Blob URL 생성, 오디오 버퍼 디코딩
    │
    ├─ 2. region = { id, src, startTime, duration, offset: 0 }
    │
    ├─ 3. audioEngine.addRegion(trackId, region)
    │          │
    │          └─ Tone.Player 생성 → Channel에 연결 → Transport 동기화
    │
    └─ 4. sessionStore.addRegion(trackId, region)
               │
               ▼
           UI 리렌더: 타임라인에 리전 블록 표시
```

### 리전 분할(Split) 흐름

```
TrackItem UI
    │
    │ splitRegion(trackId, regionId, splitTime)
    ▼
TrackController.splitRegion()
    │
    ├─ sessionStore에서 현재 리전 정보 조회 (read)
    ├─ 좌/우 duration 계산 (순수 로직)
    │
    ├─ resizeRegion(left)    → 원본 리전 축소
    │   ├─ sessionStore.updateRegion()
    │   └─ audioEngine.removeRegion() + addRegion()  (remove/add 재활용)
    │
    └─ rightRegion 생성 + 추가
        ├─ audioEngine.addRegion(rightRegion)
        └─ sessionStore.addRegion(rightRegion)
                │
                ▼
            UI 리렌더: 하나였던 블록이 두 개로 분리됨
```

---

## 11. React 연결 브릿지 — LayerContext

Vanilla Zustand는 React를 모르기 때문에 React의 반응성 시스템에 연결하는 브릿지가 필요하다.

```typescript
// LayerContext.tsx

// 1. Provider: 앱 조립 + Context 공급
export const LayerProvider: React.FC<LayerProviderProps> = ({ engine, children }) => {
  const value = useMemo(() => createApp(engine), [engine]);
  return <LayerContext value={value}>{children}</LayerContext>;
};

// 2. 명령 훅: Controller를 꺼내 UI에서 액션 호출
export function useController(): AppController {
  return useLayer().controller;
}

// 3. 상태 훅: Vanilla Store를 React 구독으로 변환
export function useSession<T>(selector: (state: SessionData) => T): T {
  const { session } = useLayer();
  return useStore(session, selector);  // Zustand의 React 어댑터
}
```

### 사용 예시 (컴포넌트)

```typescript
// Transport.tsx
function Transport() {
  const controller = useController();
  const isPlaying = useSession(s => s.isPlaying);  // 특정 상태 구독

  return (
    <button onClick={() => controller.playback.handlePlay()}>
      {isPlaying ? 'Pause' : 'Play'}
    </button>
  );
}
```

**`useSession`의 selector 패턴 장점:**
- `isPlaying`만 구독 → `bpm`이 바뀌어도 이 컴포넌트는 리렌더 안 됨
- 컴포넌트마다 필요한 상태 슬라이스만 구독 → 불필요한 리렌더 방지

---

## 12. 설계 원칙 요약

| 패턴 / 원칙 | 적용 위치 | 효과 |
|-------------|-----------|------|
| **추상화에 의존 (DIP)** | `IAudioEngine` 인터페이스 | Tone.js 교체 가능, Mock 주입 가능 |
| **Facade 패턴** | `AppController` | UI 단일 진입점, 내부 복잡도 은닉 |
| **생성자 주입 (DI)** | 모든 Controller 생성자 | 결합도 ↓, 테스트 용이성 ↑ |
| **Class 캡슐화** | `PlaybackController`, `TrackController` | `private` 멤버 보호, 유스케이스 그룹화 |
| **Composition Root** | `createApp()` | 의존성 그래프 한 곳에 집중 |
| **Vanilla Zustand** | `createSessionStore()` | React 비의존, Controller에서 동기 접근 |
| **불변 상태 업데이트** | 모든 Zustand action | 안전한 상태 변경, Zustand 변경 감지 보장 |
| **단방향 데이터 흐름** | UI → Controller → {Engine, Store} → UI | 상태 흐름 예측 가능, 디버깅 용이 |

### 레이어 간 의존 방향 (단방향 강제)

```
UI Layer
  ↓ (호출만 가능)
Controller Layer
  ↓ (호출만 가능)        ↓ (호출만 가능)
Audio Engine Layer    Session Store Layer
                              ↓ (구독)
                        UI Layer
```

- **UI → Controller:** 명령(Command) 방향
- **Store → UI:** 데이터(Subscription) 방향
- **UI가 AudioEngine을 직접 호출하는 경로는 없다**
