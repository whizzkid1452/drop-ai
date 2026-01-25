# Migration Complete: AudioEngine → AudioService

## 📋 개요

기존의 `AudioEngine` 중심 구조를 **도메인 주도 설계(Domain-Driven Design)** 기반의 `AudioService` 구조로 완전히 재설계했습니다. 이를 통해 비즈니스 로직과 프레임워크(React, Tone.js)를 분리하여 유지보수성과 확장성을 크게 향상시켰습니다.

---

## 🏗️ 새로운 아키텍처 구조

### 계층별 역할 분담

```
┌─────────────────────────────────────────────────────────┐
│                 Presentation Layer                      │
│  (React Components, Hooks)                              │
│                                                         │
│  ┌──────────────┐    ┌─────────────────────────┐        │
│  │ Components   │───▶│ useAudio Hook           │        │
│  │ (TrackList,  │    │ (ViewModel Adapter)     │        │
│  │  Cursor,     │    └──────────┬──────────────┘        │
│  │  TimeRuler)  │               │                       │
│  └──────────────┘               │                       │
└─────────────────────────────────┼───────────────────────┘
                                  │ useSyncExternalStore
                                  │ (React 18 Standard API)
┌─────────────────────────────────┼───────────────────────┐
│                 Core Layer      │                       │
│  (Pure Domain Logic)            │                       │
│                                 ▼                       │
│  ┌───────────────────────────────────────────┐          │
│  │         AudioService (Singleton)          │          │
│  │  ┌──────────────────────────────────────┐ │          │
│  │  │ Domain Models  │  Tone.js Engine     │ │          │
│  │  │ - Session      │  - Players Map      │ │          │
│  │  │ - Track        │  - Channels Map     │ │          │
│  │  │ - Region       │  - Transport        │ │          │
│  │  └──────────────────────────────────────┘ │          │
│  │                                           │          │
│  │  Methods:                                 │          │
│  │  - addRegion()    - play()                │          │
│  │  - removeRegion() - pause()               │          │
│  │  - splitRegion()  - setTime()             │          │
│  │  - setTrackVolume() - getCurrentTime()    │          │
│  │                                           │          │
│  │  React Integration:                       │          │
│  │  - subscribe(callback)                    │          │
│  │  - getSnapshot() → { tracks, isPlaying }  │          │
│  └───────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

---

## 🔑 핵심 설계 원칙

### 1. Domain Model (순수 비즈니스 로직)
**위치**: `src/core/`

각 도메인 모델은 **React나 Tone.js에 대한 의존성 없이** 순수 TypeScript로 작성되었습니다.

#### `Region` (리전 - 오디오 클립)
```typescript
class Region {
  id: string;
  startTime: number;
  sourceStartTime: number;
  duration?: number;
  audioFile?: AudioFile;

  // 비즈니스 로직
  get endTime(): number { /* ... */ }
  split(time: number): { left: Region, right: Region } | null
}
```
- **역할**: 타임라인의 오디오 클립 하나를 표현
- **로직**: 시간 계산, 자르기(Split), 경계 검증

#### `Track` (트랙 - 리전 집합)
```typescript
class Track {
  id: string;
  name: string;
  regions: Region[];
  volume: number;
  pan: number;
  isMuted: boolean;
  isSoloed: boolean;

  addRegion(region: Region): void
  removeRegion(regionId: string): void
  getRegion(regionId: string): Region | undefined
}
```
- **역할**: 여러 리전을 관리하고 오디오 속성(볼륨, 팬)을 보유
- **로직**: 리전 추가/제거, 속성 관리

#### `Session` (세션 - 프로젝트 루트)
```typescript
class Session {
  tracks: Track[];
  tempo: number;

  addTrack(track: Track): void
  getTrack(trackId: string): Track | undefined
}
```
- **역할**: 전체 프로젝트의 최상위 컨테이너
- **로직**: 트랙 관리, 전역 설정

---

### 2. AudioService (Core + Engine 통합)
**위치**: `src/core/audio/AudioService.ts`

**단일 진실 공급원(Single Source of Truth)** 패턴을 사용합니다.

#### 주요 특징
1. **Singleton 패턴**: 앱 전체에서 단 하나의 인스턴스만 존재
2. **Marriage Pattern**: 도메인 모델(Session)과 Tone.js 엔진을 1:1로 결합
3. **Event-Driven**: `emitChange()`로 상태 변경을 구독자들에게 알림

#### 내부 구조
```typescript
class AudioService {
  // 1. 도메인 모델
  private session: Session;
  
  // 2. Tone.js 엔진 오브젝트
  private channels: Map<string, Tone.Channel>;
  private players: Map<string, Map<string, Tone.Player>>;
  
  // 3. React 통합 (useSyncExternalStore API)
  private listeners: Set<() => void>;
  private currentSnapshot: any;
  
  subscribe(callback: () => void): () => void;
  getSnapshot(): { isPlaying, currentTime, tracks };
  
  // 4. 비즈니스 로직 + 엔진 제어
  async addRegion(trackId, regionData): Promise<void> {
    // 1. 도메인 업데이트
    track.addRegion(region);
    
    // 2. 엔진 동기화
    const player = new Tone.Player(...);
    this.players.set(regionId, player);
    
    // 3. UI 알림
    this.emitChange();
  }
}
```

#### 데이터 흐름
```
사용자 액션 (버튼 클릭)
    ↓
AudioService.play()
    ↓
1. Tone.Transport.start()  (엔진 제어)
2. this.emitChange()        (상태 변경 알림)
    ↓
listeners.forEach(cb => cb())  (구독자들에게 통지)
    ↓
React가 리렌더링 (useSyncExternalStore)
```

---

### 3. React 통합 (ViewModel Layer)
**위치**: `src/presentation/hooks/useAudio.ts`

#### useSyncExternalStore 패턴
React 18의 공식 API를 사용하여 외부 상태(AudioService)를 React에 연결합니다.

```typescript
export const useAudio = () => {
  const service = AudioService.getInstance();
  
  const state = useSyncExternalStore(
    service.subscribe,    // 구독 설정
    service.getSnapshot   // 현재 상태 조회
  );
  
  return state; // { isPlaying, currentTime, tracks }
};
```

#### 장점
1. **자동 리렌더링**: `AudioService`에서 `emitChange()` 호출 시 자동으로 컴포넌트 업데이트
2. **참조 안정성**: `getSnapshot()`이 캐싱을 통해 불필요한 리렌더링 방지
3. **타입 안정성**: TypeScript로 완전한 타입 추론 지원

---

## 🔄 데이터 흐름 (Complete Cycle)

### 예시: 오디오 파일 드롭 → 트랙 표시

```
1. UI Action
   사용자가 오디오 파일 드롭
   ↓
2. Event Handler
   AudioFileDrop.onFileDrop()
   ↓
3. Service Call
   AudioService.getInstance().addRegion(trackId, regionData)
   ↓
4. Domain Update
   session.addTrack(track)
   track.addRegion(region)
   ↓
5. Engine Sync
   new Tone.Player(url).connect(channel)
   ↓
6. State Change Notification
   this.emitChange()
   ↓
7. Snapshot Invalidation
   this.currentSnapshot = null
   ↓
8. React Subscription Trigger
   listeners.forEach(listener => listener())
   ↓
9. Component Re-render
   useAudio() → getSnapshot() → { tracks: Array(1) }
   ↓
10. UI Update
    TrackList renders <TrackComponent />
```

---

## 📦 완료된 마이그레이션 항목

### Core Layer
- ✅ `Region.ts` - 리전 도메인 모델 (시간 계산, split 로직)
- ✅ `Track.ts` - 트랙 도메인 모델 (리전 관리)
- ✅ `Session.ts` - 세션 도메인 모델 (프로젝트 루트)
- ✅ `AudioService.ts` - 통합 오디오 엔진 (Marriage Pattern)

### Presentation Layer
- ✅ `useAudio.ts` - React 어댑터 Hook (useSyncExternalStore)
- ✅ `App.tsx` - AudioService 초기화
- ✅ `DawPage.tsx` - useAudio로 트랙 목록 조회
- ✅ `PlaybackControls.tsx` - 재생 컨트롤
- ✅ `TrackList.tsx` - 트랙 목록
- ✅ `TimeRuler.tsx` - 타임라인 룰러
- ✅ `Cursor.tsx` - 플레이헤드 커서
- ✅ `AudioFileDrop.tsx` - 파일 드롭 핸들러
- ✅ `useAudioCommand.ts` - 명령 위임
- ✅ `useTrackActions.ts` - 트랙 액션 (splitRegion)
- ✅ `useProjectExport.ts` - Export 기능

---

## 🐛 해결된 주요 이슈

### 1. 트랙이 화면에 안 나타나는 문제
**원인**: `DawPage`가 구식 `useTrackStore`를 사용하고 있었음
```typescript
// Before
const tracks = useTrackStore(state => state.tracks);
const hasTracks = tracks.size > 0;

// After
const { tracks } = useAudio();
const hasTracks = tracks && tracks.length > 0;
```

### 2. 플레이헤드가 움직이지 않는 문제
**원인**: `Cursor`가 `usePlaybackStore`를 구독했지만, `AudioService`가 이를 업데이트하지 않음
```typescript
// Before
const unsubscribe = usePlaybackStore.subscribe(...)

// After
const { isPlaying, currentTime } = useAudio();
useEffect(() => {
  // currentTime 변경시 자동으로 커서 위치 업데이트
}, [currentTime, isPlaying]);
```

### 3. 부동소수점 정밀도 에러
**원인**: `loopEnd`가 실제 오디오 버퍼 길이를 미세하게 초과
```typescript
// playerConfig.ts
player.loopEnd = Math.min(
  startOffset + duration,
  player.buffer.duration  // 버퍼 길이로 clamp
);
```

---

## 🎯 아키텍처 개선 효과

### 1. 관심사 분리 (Separation of Concerns)
- **도메인 로직**: Core Layer (React 무관)
- **엔진 제어**: AudioService (Tone.js)
- **UI 렌더링**: Presentation Layer (React)

### 2. 단방향 데이터 흐름 (Unidirectional Data Flow)
```
Domain Model → AudioService → useAudio → Component
(Read Only) ←────── Actions ──────────────┘
```

### 3. 테스트 용이성
- **Domain Models**: 순수 함수/클래스 → 단위 테스트 가능
- **AudioService**: Mock `Session` 주입 → 통합 테스트 가능
- **Components**: `useAudio` Mock → UI 테스트 가능

### 4. 확장성
- 새로운 도메인 로직 추가: `Region`, `Track` 클래스 확장
- 새로운 오디오 기능: `AudioService` 메서드 추가
- 새로운 UI: `useAudio` 훅만 사용하면 됨

---

## 📊 성능 최적화

### 1. Snapshot 캐싱
```typescript
getSnapshot() {
  if (!this.currentSnapshot) {
    this.currentSnapshot = {
      tracks: this.session.tracks.map(...)
    };
  }
  return this.currentSnapshot;
}
```
- `emitChange()`가 호출될 때만 캐시 무효화
- 불필요한 객체 생성 방지 → 리렌더링 최소화

### 2. 선택적 구독
```typescript
// 필요한 데이터만 선택
const { tracks } = useAudio();          // trackList에서
const { isPlaying } = useAudio();       // PlaybackControls에서
const { currentTime } = useAudio();     // Cursor에서
```

---

## 🚀 다음 단계 (선택 사항)

### 레거시 코드 제거
- [ ] `src/logics/audio/audioEngine.ts` 삭제
- [ ] `useTrackStore`, `usePlaybackStore` 검토 및 제거 가능 여부 확인
- [ ] 사용되지 않는 타입 정의 정리

### 추가 도메인 로직 이동
- [ ] Snap to Grid 로직 → `core/grid/`
- [ ] Time Conversion (seconds ↔ bars/beats) → `core/time/`
- [ ] Automation/Events → `core/automation/`

### 디버그 로그 제거
- [ ] `AudioService.ts`의 `console.log` 제거
- [ ] `useAudio.ts`의 `console.log` 제거

---

## 📚 참고 자료

### 설계 패턴
- **Clean Architecture**: [Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- **Domain-Driven Design**: Eric Evans
- **useSyncExternalStore**: [React 공식 문서](https://react.dev/reference/react/useSyncExternalStore)

### 프로젝트 문서
- `src/core/README.md` - Core Layer 상세 설명
- `final_architecture.md` - 최종 아키텍처 다이어그램
- `react_viewmodel_plan.md` - React 통합 전략

---

**마이그레이션 완료일**: 2026-01-24
**테스트 상태**: ✅ 빌드 성공, 런타임 정상 동작 확인
