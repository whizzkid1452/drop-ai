# [Drop.ai](http://drop.ai/) Web DAW 프로젝트 기획

## 📋 프로젝트 개요

**목표**: Logic Pro X 스타일의 전문가용 웹 기반 DAW 제작

**플랫폼**: 브라우저 (크로스 플랫폼)

**타겟 사용자**: 음악 프로듀서, 음악가, 팟캐스터

---

## 🎯 핵심 기능 정의

### Phase 1: 기초 오디오 엔진 (2-3주)

- [x] **Web Audio API 기반 오디오 컨텍스트** (Ardour Mixer 개념)
  - ✅ AudioContext 생성 및 관리
  - ✅ 샘플레이트 설정 (44.1kHz)
  - ✅ 마스터 믹서 구성 (Master Bus) - Bus 클래스 사용
  - ✅ 오디오 라우팅 그래프 (Graph 시스템 구현)
- [x] **트랜스포트 시스템** (Ardour Transport)
  - ✅ 재생/정지/일시정지
  - ✅ BPM 설정 (30-300)
  - ✅ 위치 추적 (초 단위)
  - ✅ 위치 추적 (마디:비트) - TempoMap
  - [ ] 스크럽(scrub) 재생 지원
- [x] **메트로놈** (Ardour 클릭 트랙)
  - ✅ AudioWorklet 기반 실시간 클릭
  - ✅ BPM 실시간 변경
  - ✅ 무음 토글
  - [ ] 강세(Accent) 비트 구분

### Phase 2: 트랙 시스템 (3-4주)

- [x] **파일 관리** (기본 구현됨)
  - ✅ 파일 업로드 (MP3, WAV, OGG, M4A, AAC)
  - ⚠️ AudioBuffer 변환 및 캐싱 - 기본 구현됨, BufferManager 필요
  - ✅ 파일 라이브러리 UI (Media Pool)
  - [ ] 세션 프로젝트 관리 - Session 클래스 필요
  - [ ] 세션 저장/로드 (JSON 기반) - Session 클래스 필요
- [x] **멀티트랙 지원** (기본 구현됨)
  - ✅ 무제한 트랙 추가/삭제
  - ✅ 트랙별 볼륨 제어 (0-100%)
  - ✅ Mute/Solo 기능
  - [ ] 트랙 레코딩 상태 표시
  - [ ] Input/Output 라우팅 (Route 추상화 필요)
- [ ] **오디오 클립** (Ardour Region/Playlist 개념)
  - ⚠️ 현재 Clip으로 구현됨, Region/Playlist로 분리 필요
  - [ ] Region: 오디오 데이터 참조 (AudioBuffer) - Region 클래스 필요
  - [ ] Playlist: 타임라인에 배치된 Region 목록 - Playlist 클래스 필요
  - ✅ 드래그 앤 드롭 배치 (기본)
  - ✅ 클립 위치/시간 정확도 (기본)
  - ✅ 클립 이동/제거 (기본)
  - [ ] 클립 트리밍 (trim) 기능
  - [ ] 클립 페이드(Fade) 인/아웃
  - [ ] 스냅(Snap) 기능 (자동 정렬)

### Phase 3: 파형 시각화 (2주)

- [ ] **WaveSurfer.js 통합**
  - 실시간 파형 렌더링
  - 줌 인/아웃
  - 클립별 파형 표시
- [ ] **타임라인 룰러**
  - 마디/비트 구분선
  - 마디 번호 표시
  - 플레이헤드 시각화

### Phase 4: 편집 도구 (3-4주)

- [ ] **선택 도구** (Ardour Object Selection)
  - 구간 선택 (클릭+드래그)
  - 선택 영역 하이라이트
  - 멀티 클립 선택 (Ctrl+Click)
  - 전체 선택 (Ctrl+A)
- [ ] **자르기/복사/붙여넣기** (Ardour Editor Tools)
  - 클립 분할 (Split at playhead)
  - 클립보드 관리
  - 해제/다시 실행 (Undo/Redo stack)
  - 클립 복제 (Duplicate)
  - 시간 조정 (Time stretch)
- [ ] **페이드 효과** (Ardour Region Fade)
  - 페이드 인/아웃
  - 볼륨 엔벨로프
  - 자동 크로스페이드 (Crossfade)
  - 로지/리니어 페이드 곡선

### Phase 5: AI 기능 (2-3주)

- [ ] **자연어 명령어**
  - "재생", "정지" 등 기본 명령
  - "120 bpm" 등 설정 명령
  - 한국어/영어 지원
- [ ] **향후 AI 확장**
  - 자동 리듬 정렬
  - 스마트 믹싱 제안

### Phase 6: 믹싱 & 이펙트 (4-5주)

- [ ] **믹서 패널** (Ardour Mixer Strip 구조)
  - 트랙별 믹서 컨트롤
  - 팬(Pan) 조절 (-100% ~ +100%)
  - 이퀄라이저 (기본 3밴드)
  - 입력 게인 조절
  - 미터링(Metering) 표시
- [ ] **이펙트** (Ardour Plugin 개념)
  - 프로세서 체인 시스템
  - 플러그인 베이스 클래스 구현
  - 리버브 (Convolution Reverb)
  - 딜레이 (Echo/Delay)
  - 컴프레서 (추후)
  - 이펙트 체인 (Send/Insert)
  - 이펙트 슬롯 관리
  - 플러그인 바이패스/활성화
  - 레이턴시 보상

### Phase 7: 세션 관리 & 내보내기 (2-3주)

- [ ] **세션 저장/로드** (Ardour Session 시스템)
  - JSON 기반 세션 파일 형식
  - IndexedDB를 통한 로컬 저장
  - 자동 저장 (Auto-save)
  - 세션 버전 관리
  - 프로젝트 메타데이터 관리
- [ ] **오디오 내보내기** (Ardour Export 개념)
  - 오디오 파일 내보내기 (WAV, MP3)
  - 내보내기 범위 선택
  - 샘플레이트 선택
  - 비트 심도 선택
  - 정규화 옵션

---

## 🏗️ 아키텍처 설계

### 설계 철학

다음과 같은 설계 원칙을 따릅니다:

1. **계층 분리**: Frontend (React) ↔ Core Engine (Web Audio API) ↔ Backend (브라우저)
2. **세션 중심 설계**: 모든 상태를 세션(Session) 객체로 관리
3. **그래프 기반 오디오 처리**: 노드 기반 오디오 라우팅 그래프
4. **Region/Playlist 분리**: 데이터(Region)와 배치(Playlist)의 분리
5. **프로세서 체인**: 플러그인을 체인 형태로 연결하여 처리

### 아키텍처 계층 구조

```
┌─────────────────────────────────────────┐
│   Presentation Layer (React Components)│  ← UI 렌더링 및 사용자 인터랙션
├─────────────────────────────────────────┤
│   State Management Layer                 │  ← 세션 상태 관리 (Zustand/Redux)
├─────────────────────────────────────────┤
│   Core Audio Engine Layer               │  ← 오디오 처리 엔진 (Web Audio API)
│   ├── Session (세션 관리)               │
│   ├── AudioEngine (오디오 엔진)         │
│   ├── Route (트랙/버스)                 │
│   ├── Region (클립 데이터)              │
│   ├── Playlist (타임라인 배치)          │
│   └── Processor (이펙트 체인)           │
├─────────────────────────────────────────┤
│   Backend Layer (Browser APIs)          │  ← Web Audio API, File API, IndexedDB
└─────────────────────────────────────────┘
```

### 기술 스택

```tsx
Frontend:
- React 19 (UI 프레임워크)
- TypeScript (타입 안전성)
- Vanilla Extract (CSS-in-JS)
- Radix UI (컴포넌트)
- TanStack Query (데이터 페칭)
- Zustand (상태 관리, 세션 상태)

Audio Engine:
- Web Audio API (네이티브 오디오)
- AudioWorklet (실시간 처리, 메트로놈)
- Tone.js 또는 직접 구현 (스케줄링)
- WaveSurfer.js (파형 시각화)

Storage:
- IndexedDB (세션 저장/로드)
- LocalStorage (사용자 설정)

Build Tools:
- Vite (빌드 도구)
- pnpm (패키지 매니저)
- Docker (컨테이너 배포)

```

### 핵심 클래스 구조 (Ardour 스타일)

```
Session (세션 관리)
  ├── AudioEngine (오디오 엔진, 실시간 처리)
  ├── Transport (트랜스포트 제어)
  ├── TempoMap (템포/마디 정보)
  ├── Route[] (트랙/버스 목록)
  │     ├── AudioTrack
  │     ├── MidiTrack
  │     └── Bus (Master, Aux)
  ├── Playlist[] (타임라인 배치)
  │     └── Region[] (클립 참조)
  └── Project (프로젝트 메타데이터)

Region (클립 데이터)
  ├── AudioRegion (오디오 클립)
  └── MidiRegion (MIDI 클립)

Processor (처리 체인)
  ├── PluginProcessor (이펙트)
  ├── SendProcessor (센드)
  └── ReturnProcessor (리턴)
```

### 폴더 구조

```
src/
├── core/
│   ├── audio/
│   │   ├── AudioEngine.ts         # 메인 오디오 엔진 (Ardour AudioEngine 참고)
│   │   ├── Session.ts             # 세션 관리 (Ardour Session 참고)
│   │   ├── Transport.ts          # 트랜스포트 제어
│   │   ├── Metronome.ts          # 메트로놈 (AudioWorklet)
│   │   ├── Route.ts               # 트랙/버스 (Ardour Route 참고)
│   │   ├── Track.ts               # 트랙 구현
│   │   ├── Bus.ts                 # 버스 (Master, Aux)
│   │   ├── Region.ts              # 클립 데이터 (Ardour Region 참고)
│   │   ├── AudioRegion.ts        # 오디오 클립
│   │   ├── Playlist.ts           # 타임라인 배치 (Ardour Playlist 참고)
│   │   ├── Processor.ts         # 프로세서 베이스 (Ardour Processor 참고)
│   │   ├── ProcessorChain.ts    # 프로세서 체인
│   │   ├── PluginProcessor.ts   # 플러그인 프로세서
│   │   ├── Graph.ts             # 오디오 그래프 (Ardour Graph 참고)
│   │   ├── BufferManager.ts     # 버퍼 관리 (메모리 최적화)
│   │   └── TempoMap.ts          # 템포 맵 (Ardour Temporal 참고)
│   ├── models/
│   │   ├── SessionData.ts        # 세션 데이터 모델
│   │   ├── Project.ts            # 프로젝트 상태
│   │   └── types.ts              # 타입 정의
│   └── utils/
│       ├── timeConverter.ts      # 시간 변환 유틸 (BBT, Timecode)
│       ├── fileReader.ts         # 파일 처리
│       ├── audioBufferCache.ts   # AudioBuffer 캐싱
│       └── sessionSerializer.ts  # 세션 직렬화/역직렬화
├── components/
│   ├── DAW/
│   │   ├── DAW.tsx               # 메인 DAW 컴포넌트
│   │   ├── TransportBar.tsx    # 재생 컨트롤
│   │   ├── TrackList.tsx        # 트랙 리스트
│   │   ├── Timeline.tsx         # 타임라인 뷰
│   │   ├── Ruler.tsx           # 타임라인 룰러
│   │   ├── FileLibrary.tsx     # 파일 라이브러리
│   │   └── Mixer.tsx           # 믹서 패널
│   └── Toolbar.tsx             # 편집 도구 모음
├── hooks/
│   ├── useAudioEngine.ts        # 오디오 엔진 훅
│   ├── useSession.ts            # 세션 훅
│   ├── useMetronome.ts         # 메트로놈 훅
│   └── useUndoRedo.ts         # 해제/다시실행
├── plugins/
│   ├── BasePlugin.ts           # 플러그인 베이스 클래스
│   ├── ReverbPlugin.ts        # 리버브
│   ├── DelayPlugin.ts         # 딜레이
│   └── EQPlugin.ts            # 이퀄라이저
├── styles/
│   ├── global.css.ts          # 전역 스타일
│   └── components.css.ts     # 컴포넌트 스타일
├── App.tsx                    # 앱 루트
└── main.tsx                   # 진입점
```

### 오디오 그래프 구조

Ardour의 Graph 시스템을 참고하여 노드 기반 오디오 라우팅을 구현:

```
Input → Processor Chain → Send → Master Bus → Output
         ├── Plugin 1
         ├── Plugin 2
         └── Plugin 3
```

**특징**:

- 의존성 그래프 해결 (순환 참조 방지)
- 동적 연결/해제 지원
- 레이턴시 보상
- 병렬 처리 최적화

### 세션 관리 시스템

Ardour의 Session 개념을 참고:

**세션 구조**:

```typescript
Session {
  project: Project          // 프로젝트 메타데이터
  routes: Route[]          // 트랙/버스 목록
  playlists: Playlist[]    // 타임라인 배치
  tempoMap: TempoMap       // 템포/마디 정보
  locations: Location[]    // 마커/루프 포인트
  undoStack: UndoStack     // 언두/리두
}
```

**세션 저장/로드**:

- JSON 기반 세션 파일 (Ardour는 XML 사용)
- IndexedDB로 로컬 저장
- 자동 저장 (Auto-save)
- 버전 관리

### Region/Playlist 시스템

Ardour의 Region과 Playlist 분리 개념:

- **Region**: 실제 오디오 데이터 참조 (AudioBuffer)
  - 위치, 길이, 페이드 정보 포함
  - 여러 Playlist에서 재사용 가능
- **Playlist**: 타임라인에 배치된 Region 목록
  - 각 트랙마다 하나의 Playlist
  - Region의 시작 시간, 레이어 순서 관리

**장점**:

- 같은 파일을 여러 곳에서 재사용 가능
- 메모리 효율적
- 복사/이동 연산 최적화

### 프로세서 체인 시스템

Ardour의 Processor 체인 구조:

```
Route → Processor Chain
  ├── Pre-Fader Processor
  ├── Fader (Gain)
  ├── Post-Fader Processor
  ├── Send (선택적)
  └── Pan
```

**특징**:

- 순서 보장 (Insert 순서)
- 동적 활성화/비활성화
- 바이패스 지원
- 레이턴시 자동 보상

### 버퍼 관리 전략

Ardour의 BufferManager 개념을 참고:

- **AudioBuffer 풀링**: 재사용 가능한 버퍼 풀 관리
- **메모리 단편화 최소화**: 고정 크기 버퍼 사용
- **실시간 안전 할당**: AudioWorklet에서 사용 가능한 버퍼 관리
- **캐싱**: 같은 파일의 AudioBuffer 재사용

---

## 📊 구현 우선순위

### ✅ 현재 구현 상태

**완료된 항목:**

- ✅ 기본 AudioEngine (오디오 컨텍스트 관리)
- ✅ Transport 시스템 (재생/정지/BPM)
- ✅ Metronome (AudioWorklet 기반)
- ✅ 기본 Track 클래스 (볼륨/Pan/Mute/Solo)
- ✅ 기본 Clip 클래스 (재생/정지)
- ✅ 파일 업로드 및 재생

**부분 구현:**

- ⚠️ 마스터 믹서 (기본 GainNode만 있음, Bus 클래스 필요)
- ⚠️ Clip 시스템 (Region/Playlist 분리 필요)

**미구현 핵심 기능:**

- [ ] Session 클래스 (세션 상태 중앙 관리)
- [ ] Region/Playlist 분리 시스템
- [ ] Route 추상화 (Track/Bus 공통 인터페이스)
- [ ] Bus 클래스 (Master/Aux)
- [ ] Graph 시스템 (오디오 라우팅 그래프)
- [ ] Processor Chain (이펙트 체인)
- [ ] TempoMap (템포/마디 정보)
- [ ] BufferManager (버퍼 캐싱/풀링)

---

### 🎯 Ardour 기능 이전 우선순위

#### Phase 0: 핵심 아키텍처 (Ardour Foundation) - 4-5주

**우선순위 1: Session 클래스** (1주)

- [ ] Session.ts 구현
  - AudioEngine 통합 관리
  - Routes (트랙/버스) 관리
  - Playlists 관리
  - Undo/Redo 스택 관리
  - 세션 저장/로드 인터페이스
- [ ] SessionData.ts 모델 정의
- [ ] 세션 직렬화/역직렬화 기본 구조

**우선순위 2: Region/Playlist 분리** (1주)

- [ ] Region.ts (오디오 데이터 참조)
  - AudioBuffer 캐싱
  - 페이드 정보 관리
- [ ] AudioRegion.ts (오디오 Region 구현)
- [ ] Playlist.ts (타임라인 배치)
  - Region 참조 목록
  - 시간 기반 정렬
  - 레이어 관리
- [ ] 기존 Clip을 Region/Playlist로 마이그레이션

**우선순위 3: Route 추상화** (1주)

- [ ] Route.ts 베이스 클래스
  - 프로세서 체인 인터페이스
  - Send/Return 구조
  - Input/Output 라우팅
- [ ] Track을 Route 상속으로 변경
- [ ] Bus.ts 구현 (Master/Aux)
- [ ] Route 그룹 관리

**우선순위 4: Graph 시스템** (1주)

- [ ] Graph.ts 구현
  - 오디오 노드 그래프 구성
  - 의존성 해결 (Topological Sort)
  - 순환 참조 방지
  - 동적 연결/해제
- [ ] Route 간 라우팅 관리
- [ ] 레이턴시 계산 및 보상

**우선순위 5: Processor Chain** (1주)

- [ ] Processor.ts 베이스 클래스
- [ ] ProcessorChain.ts 구현
  - Pre-Fader/Post-Fader 구분
  - Send/Return 처리
  - 바이패스 지원
- [ ] Route에 Processor Chain 통합

---

#### Phase 1: 시간 및 버퍼 관리 (2주)

**우선순위 6: TempoMap** (1주)

- [x] TempoMap.ts 구현
  - ✅ BPM 변화 추적
  - ✅ 마디/비트 계산 (BBT)
  - ✅ 시간 변환 유틸 (초/비트/BBT 간 변환)
- [x] Transport에 TempoMap 통합
- [ ] UI에 마디/비트 표시

**우선순위 7: BufferManager** (1주)

- [ ] BufferManager.ts 구현
  - AudioBuffer 풀링 시스템
  - 파일별 캐싱 (Source 개념)
  - 메모리 관리 및 해제
- [ ] Region에서 BufferManager 사용

---

#### Phase 2: 편집 기능 강화 (2-3주)

**우선순위 8: Undo/Redo 시스템** (1주)

- [ ] Command 패턴 구현
- [ ] UndoStack.ts 구현
- [ ] 주요 작업에 Undo/Redo 적용

**우선순위 9: 세션 저장/로드** (1주)

- [ ] JSON 세션 파일 형식 정의
- [ ] SessionSerializer.ts 구현
- [ ] IndexedDB 저장/로드
- [ ] 자동 저장 기능

---

### 🚀 MVP (최소 기능 제품) - 업데이트된 로드맵

1. ✅ 오디오 엔진 구축 (2주) - 완료
2. ✅ 메트로놈 + 트랜스포트 (1주) - 완료
3. ✅ 파일 업로드 + 단일 트랙 재생 (1주) - 완료
4. ✅ 파형 시각화 (1주) - 완료
5. [ ] 기본 편집 (자르기) (1주) - Region/Playlist 분리 후
6. [ ] Session 클래스 (1주) - Ardour Foundation
7. [ ] Route/Bus 시스템 (1주) - Ardour Foundation

### 📈 v1.0 (출시 준비) - 추가 4주

1. [ ] 멀티트랙 고급 기능 (Graph 시스템) (1주)
2. [ ] AI 명령어 (1주)
3. [ ] 세션 저장/로드 완성 (1주)
4. [ ] Undo/Redo 시스템 (1주)

### 🎨 v2.0 (고급 기능) - 추가 8주

1. [ ] 이펙트 추가 (Processor Chain) (3주)
2. [ ] 고급 편집 도구 (2주)
3. [ ] 세션 내보내기 (1주)
4. [ ] 합성기/샘플러 (2주)

---

## 🎨 UI/UX 디자인

### 디자인 컨셉

- **Logic Pro X 스타일**: 다크 테마, 전문가용 인터페이스
- **색상**:
  - 배경: `#1a1a1a`
  - 트랙: `#2d2d2d`
  - 액센트: `#007aff` (파란색)
- **레이아웃**:
  - 상단: 트랜스포트 바
  - 좌측: 파일 라이브러리
  - 중앙: 타임라인 + 트랙
  - 하단: AI 명령어 입력

### Radix UI 활용

- Dialog: 파일 업로드 모달
- Toast: 작업 완료 알림
- Tooltip: 도구 설명
- Tabs: 편집 도구 전환

---

## ⚠️ 기술적 고려사항

### 성능 최적화

- **AudioBuffer 캐싱**: 같은 파일의 AudioBuffer 재사용 (Ardour의 Source 개념)
- **버퍼 풀링**: 재사용 가능한 AudioBuffer 풀 관리
- **AudioWorklet 활용**: 실시간 오디오 처리 (Ardour의 ProcessThread 개념)
- **Web Worker 활용**: 오프라인 처리 (파일 로드, 파형 렌더링)
- **Virtual scrolling**: 많은 클립 관리 시 성능 최적화
- **Request Animation Frame**: UI 리렌더링 최소화
- **메모리 관리**: 불필요한 AudioBuffer 해제, 가비지 컬렉션 최적화
- **그래프 최적화**: 오디오 그래프의 순환 참조 방지 및 최적 경로 계산

### 브라우저 호환성

- Chrome/Edge: 최우선 지원
- Firefox: 2순위
- Safari: Web Audio API 제약 고려

### 제약사항

- 파일 크기 제한: 50MB
- 트랙 수 제한: 32개 (확장 가능)
- 실시간 오디오 처리 딜레이 최소화

---

## 🧪 테스트 전략

### 단위 테스트

- 오디오 엔진 로직
- 시간 변환 함수
- 파일 파서

### 통합 테스트

- 재생/정지 흐름
- 트랙 추가/삭제
- 클립 배치/이동

### E2E 테스트

- 사용자 워크플로우
- 파일 업로드 → 편집 → 재생

---

## 📅 개발 일정

### Week 1-2: 기초 셋업

- 프로젝트 구조 생성
- 오디오 엔진 클래스 구현
- 메트로놈 구현

### Week 3-4: 트랙 시스템

- 파일 업로드 구현
- 단일 트랙 재생
- WaveSurfer.js 통합

### Week 5-6: MVP 완성

- 멀티트랙 지원
- 기본 편집 기능
- UI/UX 개선

### Week 7+: 고급 기능

- AI 명령어
- 이펙트 추가
- 최적화 및 버그 수정

---

## 🎯 성공 지표

- ✅ 최소 3개 트랙 동시 재생
- ✅ 100ms 이하 오디오 지연
- ✅ 50MB 파일 로드 5초 이내
- ✅ 브라우저 메모리 사용량 500MB 이하
- ✅ 사용자 만족도 4/5 이상

---

## 📝 다음 단계 (Ardour 기능 이전)

### 🎯 즉시 시작할 작업

**1단계: Session 클래스 구현** (우선순위 최상)

```
src/core/audio/Session.ts
src/core/models/SessionData.ts
src/core/utils/sessionSerializer.ts
```

- [ ] Session 클래스 기본 구조
- [ ] AudioEngine 통합
- [ ] Routes 관리 인터페이스
- [ ] 세션 데이터 모델 정의

**2단계: Region/Playlist 분리**

```
src/core/audio/Region.ts
src/core/audio/AudioRegion.ts
src/core/audio/Playlist.ts
```

- [ ] Region 베이스 클래스
- [ ] AudioRegion 구현
- [ ] Playlist 클래스 (Region 참조 관리)
- [ ] 기존 Clip 마이그레이션

**3단계: Route 추상화**

```
src/core/audio/Route.ts
src/core/audio/Bus.ts
```

- [ ] Route 베이스 클래스
- [ ] Bus 클래스 (Master/Aux)
- [ ] Track을 Route 상속으로 변경

**4단계: Graph 시스템**

```
src/core/audio/Graph.ts
```

- [ ] 오디오 그래프 구성 로직
- [ ] 의존성 해결 알고리즘
- [ ] 순환 참조 검사

### 📚 Ardour 소스 코드 참고 파일

**핵심 구현 참고:**

- `libs/ardour/session.cc` → Session 클래스
- `libs/ardour/route.cc` → Route 추상화
- `libs/ardour/audioregion.cc` → Region 구현
- `libs/ardour/playlist.cc` → Playlist 구현
- `libs/ardour/graph.cc` → Graph 시스템
- `libs/ardour/processor.cc` → Processor Chain
- `libs/temporal/` → TempoMap 구현

### 🔧 의존성 및 도구

**필요한 패키지:**

- ✅ React 19 (이미 설치됨)
- ✅ TypeScript (이미 설치됨)
- [ ] Zustand (상태 관리) - Session 상태용
- [ ] IndexedDB 유틸 (세션 저장용)

**설계 원칙:**

1. Ardour의 아키텍처를 웹 환경에 맞게 변환
2. 단계별 구현 및 테스트
3. 각 단계마다 기존 코드와의 통합 검증
4. 성능 최적화 고려 (메모리, 레이턴시)

### 📋 체크리스트

**Phase 0 완료 기준:**

- [ ] Session 클래스로 모든 상태 관리 가능
- [ ] Region과 Playlist가 분리되어 동작
- [ ] Route 추상화로 Track과 Bus 통합 관리
- [ ] Graph 시스템으로 오디오 라우팅 관리
- [ ] Processor Chain 기본 구조 완성

**통합 테스트:**

- [ ] 세션 생성/저장/로드
- [ ] 트랙 추가/삭제
- [ ] Region 배치/이동
- [ ] 재생/정지 동작 확인

---

## 🤝 기여 가이드

### 코딩 규칙

- TypeScript strict mode
- 함수형 컴포넌트 + Custom Hooks
- Vanilla Extract로 스타일링
- ESLint + Prettier 준수

### Git 브랜치 전략

- `main`: 프로덕션
- `develop`: 개발
- `feature/xxx`: 기능 개발
- `bug/xxx`: 버그 수정

---

## 📚 참고 자료 및 학습 포인트

### Ardour 아키텍처 참고

Ardour 프로젝트를 분석하여 다음 개념들을 참고합니다:

1. **Session 클래스** (`libs/ardour/session.cc`)
   - 세션 초기화/로드/저장 로직
   - Route 관리
   - Playlist 관리
   - 언두/리두 시스템

2. **AudioEngine 클래스** (`libs/ardour/audioengine.cc`)
   - 실시간 오디오 처리 루프
   - 백엔드 추상화
   - 프로세스 스레드 관리

3. **Route 클래스** (`libs/ardour/route.cc`)
   - 트랙/버스 처리 로직
   - 프로세서 체인 관리
   - Send/Return 구조

4. **Graph 클래스** (`libs/ardour/graph.cc`)
   - 오디오 그래프 구성
   - 의존성 해결
   - 순환 참조 방지

5. **Region/Playlist** (`libs/ardour/audioregion.cc`, `libs/ardour/playlist.cc`)
   - Region 데이터 구조
   - Playlist 배치 로직
   - 복사/이동/스플리트 연산

### 웹 환경에서의 구현 전략

**Ardour의 네이티브 개념 → 웹 구현 매핑**:

| Ardour (Native)          | Web DAW (Browser)        |
| ------------------------ | ------------------------ |
| ProcessThread            | AudioWorklet             |
| JACK/CoreAudio Backend   | Web Audio API            |
| File I/O (libsndfile)    | File API + Web Audio API |
| GTK2 UI                  | React Components         |
| XML Session Files        | JSON Session Files       |
| Native Plugins (LV2/VST) | Web Audio API Nodes      |
| Shared Memory            | Transferable Objects     |

### 주요 설계 결정사항

1. **세션 중심 설계**: 모든 상태를 Session 객체로 관리하여 일관성 유지
   - ✅ 현재: AudioEngine이 직접 관리 (Session 클래스 필요)
   - 🎯 목표: Session이 AudioEngine, Routes, Playlists를 모두 관리

2. **Region/Playlist 분리**: 메모리 효율성과 재사용성 향상
   - ⚠️ 현재: Clip이 데이터와 배치를 모두 포함
   - 🎯 목표: Region(데이터)과 Playlist(배치) 분리

3. **그래프 기반 처리**: 확장 가능한 오디오 라우팅 구조
   - [ ] 현재: 직접 연결 방식
   - 🎯 목표: Graph 시스템으로 의존성 관리 및 최적화

4. **Route 추상화**: Track과 Bus의 공통 인터페이스
   - ⚠️ 현재: Track만 존재, Bus 없음
   - 🎯 목표: Route 베이스 클래스로 Track/Bus 통합

5. **프로세서 체인**: 플러그인을 체인 형태로 연결하여 유연한 처리
   - [ ] 현재: Gain/Pan만 직접 구현
   - 🎯 목표: Processor Chain으로 확장 가능한 구조

6. **버퍼 관리**: 메모리 단편화 최소화 및 실시간 안전성 보장
   - ⚠️ 현재: 기본 AudioBuffer 사용
   - 🎯 목표: BufferManager로 풀링 및 캐싱

### Ardour → Web DAW 아키텍처 매핑 상세

| Ardour 개념    | 현재 상태        | 목표 구현         | 파일                               |
| -------------- | ---------------- | ----------------- | ---------------------------------- |
| Session        | ❌ 없음          | Session.ts        | `src/core/audio/Session.ts`        |
| AudioEngine    | ✅ 기본 구현     | ✅ 개선 필요      | `src/core/audio/AudioEngine.ts`    |
| Route          | ❌ 없음          | Route.ts (베이스) | `src/core/audio/Route.ts`          |
| Track          | ✅ 기본 구현     | Route 상속        | `src/core/audio/Track.ts`          |
| Bus            | ❌ 없음          | Route 상속        | `src/core/audio/Bus.ts`            |
| Region         | ⚠️ Clip으로 통합 | Region.ts         | `src/core/audio/Region.ts`         |
| AudioRegion    | ⚠️ Clip으로 통합 | AudioRegion.ts    | `src/core/audio/AudioRegion.ts`    |
| Playlist       | ❌ 없음          | Playlist.ts       | `src/core/audio/Playlist.ts`       |
| Processor      | ❌ 없음          | Processor.ts      | `src/core/audio/Processor.ts`      |
| ProcessorChain | ❌ 없음          | ProcessorChain.ts | `src/core/audio/ProcessorChain.ts` |
| Graph          | ❌ 없음          | Graph.ts          | `src/core/audio/Graph.ts`          |
| TempoMap       | ✅ 구현 완료     | ✅ 완료           | `src/core/audio/TempoMap.ts`       |
| BufferManager  | ❌ 없음          | BufferManager.ts  | `src/core/audio/BufferManager.ts`  |
| Transport      | ✅ 구현됨        | ✅ 유지           | `src/core/audio/Transport.ts`      |
| Metronome      | ✅ 구현됨        | ✅ 유지           | `src/core/audio/Metronome.ts`      |

### 추가 학습 자료

- [Ardour 공식 문서](https://ardour.org/development.html)
- [Web Audio API 문서](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioWorklet 가이드](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
- [Ardour 소스 코드](https://github.com/Ardour/ardour)
