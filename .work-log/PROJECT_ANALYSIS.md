# Drop-AI 프로젝트 분석

## 프로젝트 개요

**브라우저 기반 DAW(Digital Audio Workstation) + AI 에이전트**

오디오 파일을 업로드하고, 트랙에 배치하고, 재생/믹싱을 제어하며, AI 대화 인터페이스(WebLLM 로컬 추론)로 조작할 수 있는 웹 앱.

| 항목 | 내용 |
|------|------|
| 기술 스택 | React 19 + TypeScript + Vite + Tone.js |
| 상태 관리 | Zustand (Vanilla + React hooks) |
| 스타일링 | Vanilla Extract CSS |
| AI | WebLLM (Qwen2.5-0.5B, 브라우저 로컬 추론) |
| 테스트 | Vitest (단위) + Playwright (E2E) |
| 런타임 | Node 22.11.0, pnpm 9.12.2 |

---

## 아키텍처

### 레이어 구조

```
┌─────────────────────────────────────────────┐
│  Apps Layer (DawPage, AgentTerminal, CLI)    │  ← React UI
├─────────────────────────────────────────────┤
│  Controllers (AppController - Facade)        │  ← 비즈니스 로직 진입점
├──────────────────┬──────────────────────────┤
│  Session Store   │  AudioEngine (Tone.js)   │  ← 상태 / 오디오 처리
│  (Vanilla Zustand)│  (IAudioEngine 인터페이스) │
└──────────────────┴──────────────────────────┘
```

**핵심 규칙** (`src/layers/discipline.md`):

- Apps → Controllers만 호출 (AudioEngine/Session 직접 접근 금지)
- Controllers가 유일한 상태 변경 진입점
- AudioEngine은 인터페이스 기반 (의존성 역전)
- Session은 Controllers에 의해서만 업데이트

### 디렉토리 구조

```
src/
├── components/
│   ├── Daw/                         # 메인 DAW UI
│   │   ├── DawPage.tsx              # 3패널 레이아웃 컨테이너
│   │   ├── components/
│   │   │   ├── DawHeader.tsx        # 트랙 수 & 내보내기 정보
│   │   │   ├── TrackList.tsx        # 트랙 목록 렌더링
│   │   │   ├── TrackInfoSidebar.tsx # 좌측 트랙 정보 패널
│   │   │   ├── TimeRuler.tsx        # 타임라인 눈금자
│   │   │   ├── PlaybackControls/    # 재생/일시정지/정지 + 프로그레스 바
│   │   │   ├── Track/
│   │   │   │   ├── TrackComponent.tsx     # 개별 트랙 (웨이브폼 리전)
│   │   │   │   ├── TrackHeader.tsx        # 트랙 이름, 아이콘
│   │   │   │   ├── TrackVolumeController.tsx
│   │   │   │   ├── TrackPanController.tsx
│   │   │   │   └── RegionComponent.tsx    # 오디오 리전 시각화
│   │   │   ├── Cursor/              # 재생 커서
│   │   │   ├── ExportButton/        # WAV 내보내기
│   │   │   │   ├── ExportButton.tsx
│   │   │   │   └── utils/
│   │   │   │       ├── audioExport.ts
│   │   │   │       └── wavConverter.ts
│   │   │   └── Terminals/
│   │   │       ├── Terminal.tsx           # 터미널 탭 전환
│   │   │       ├── AgentTerminal/        # AI 채팅 인터페이스
│   │   │       │   ├── AgentTerminal.tsx
│   │   │       │   ├── components/
│   │   │       │   │   ├── AgentTerminalHeader.tsx
│   │   │       │   │   ├── CommandComposer.tsx
│   │   │       │   │   ├── MessageList.tsx
│   │   │       │   │   ├── ModelLoadingOverlay.tsx
│   │   │       │   │   └── QuickGuide.tsx
│   │   │       │   └── utils/
│   │   │       │       ├── formatLoadingDisplayText.ts
│   │   │       │       ├── getSystemPrompt.ts
│   │   │       │       ├── messageHelpers.ts
│   │   │       │       ├── aiResponseHandler.ts
│   │   │       │       └── queryToLLM.ts
│   │   │       └── CliTerminal/
│   │   │           └── CliTerminal.tsx
│   │   └── hooks/
│   │       └── useTrackActions.ts
│   │
│   ├── Drop/                        # 파일 업로드 랜딩 페이지
│   │   ├── DropPage.tsx
│   │   └── DropPreviewModal.tsx
│   │
│   ├── common/
│   │   ├── FileDrop/                # 드래그&드롭 오디오 파일 처리
│   │   │   ├── AudioFileDrop.tsx
│   │   │   ├── BasicFileDrop.tsx
│   │   │   └── constants/audioConstants.ts
│   │   ├── ErrorBoundary/GlobalErrorFallback.tsx
│   │   ├── AnalyticsTracker.tsx
│   │   └── DebouncedInput.tsx
│   │
│   └── Layouts/DefaultLayout.tsx
│
├── router/
│   └── AppRouter.tsx                # /, /daw, /cli-test, /web-daw
│
├── stores/                          # Zustand React hooks
│   ├── useTrackStore.ts             # 트랙 & 리전 CRUD
│   ├── usePlaybackStore.ts          # 재생 상태
│   ├── useAgentStore.ts             # AI 모델 로딩 상태
│   └── useAudioFileStore.ts
│
├── hooks/
│   └── agent/
│       ├── useAgent/                # 메인 에이전트 훅
│       │   ├── useAgent.ts
│       │   └── utils/
│       │       ├── aiResponseHandler.ts
│       │       ├── errorHandler.ts
│       │       ├── getSystemPrompt.ts
│       │       ├── messageHelpers.ts
│       │       └── queryToLLM.ts
│       └── useWebLLM.ts             # WebLLM 엔진 초기화
│
├── layers/                          # 신규 레이어 아키텍처 (마이그레이션 중)
│   ├── discipline.md                # 아키텍처 규칙 & 제약사항
│   ├── audio-engine/
│   │   ├── i-audio-engine.ts        # 인터페이스 (IAudioEngine)
│   │   └── audio-engine.ts          # Tone.js 구현체
│   ├── session/
│   │   └── session.ts               # Vanilla Zustand 스토어
│   ├── controllers/
│   │   ├── index.ts                 # AppController (Facade)
│   │   ├── playback-controller.ts   # 재생/탐색/BPM/루프/마스터
│   │   └── track-controller.ts      # 트랙 & 리전 조작
│   ├── apps/
│   │   ├── create-app.ts            # Composition Root (팩토리)
│   │   ├── context/LayerContext.tsx  # React Context Provider
│   │   ├── cli/                     # CLI 앱 레이어
│   │   │   ├── index.ts
│   │   │   ├── cli-test-page.tsx
│   │   │   └── constants.ts
│   │   └── web/                     # WebDAW (실험적)
│   │       ├── WebDAW.tsx
│   │       └── ui/components/
│   │           ├── transport/
│   │           └── track-list/
│   ├── integration.test.ts
│   └── integration-test.ts
│
├── core/                            # 레거시 도메인 모델
│   ├── audio/
│   │   ├── AudioService.ts          # Facade (마이그레이션 대상)
│   │   └── export/
│   │       ├── AudioExporter.ts
│   │       ├── ExportOptions.ts
│   │       └── index.ts
│   ├── session/Session.ts
│   ├── track/Track.ts
│   └── region/Region.ts
│
├── logics/audio/                    # 오디오 처리 함수
│   ├── useAudioCommand.ts           # AI → AudioService 브릿지
│   ├── audioEngine.errors.ts
│   ├── convertFileToAudioFile.ts
│   ├── exportProject.ts             # Tone.Offline 기반 내보내기
│   ├── getAudioMetadata.ts
│   ├── loadAndDecodeAudioBuffer.ts
│   ├── playerConfig.ts
│   ├── regionRenderer.ts
│   └── index.ts
│
├── presentation/
│   └── hooks/useAudioService.ts     # ViewModel 어댑터
│
├── types/
│   ├── track.ts                     # Track, Region, TrackStatus
│   ├── audioFile.ts                 # AudioFile
│   ├── agent.ts                     # Message, Role, AgentStatus
│   ├── audioTypes.ts                # AudioSnapshot
│   ├── audioCommand.schema.ts       # Zod 스키마 (AI 명령 검증)
│   ├── statusTypes.ts
│   └── webllm.types.ts
│
├── styles/
│   └── global.css.ts                # 글로벌 스타일 (다크 테마)
│
├── utils/
│   ├── analytics.ts                 # GA4 이벤트
│   ├── wav-encoder.ts
│   ├── audio/
│   │   ├── formatDuration.ts
│   │   └── formatFileSize.ts
│   ├── hardwareInfo.ts
│   └── visual-width.ts
│
├── workers/
│   └── llm.worker.ts               # Web Worker (LLM 추론)
│
└── App.tsx                          # 루트 컴포넌트
```

---

## 상태 관리

### 4개 Store 병존 현황

| Store | 위치 | 타입 | 용도 |
|-------|------|------|------|
| `useTrackStore` | `src/stores/useTrackStore.ts` | React Zustand | 트랙/리전 CRUD (`Map<string, Track>`) |
| `usePlaybackStore` | `src/stores/usePlaybackStore.ts` | React Zustand | 재생 상태 (`isPlaying`, `currentTime`, `tempo`) |
| `useAgentStore` | `src/stores/useAgentStore.ts` | React Zustand | AI 모델 로딩 (`isModelReady`, progress) |
| `SessionStore` | `src/layers/session/session.ts` | Vanilla Zustand | 신규 레이어 전용 (`tracks`, `bpm`, `masterVolume`) |

> Legacy `AudioService` 내부에도 Zustand 스토어가 존재하여 `AudioSnapshot`을 관리함.

---

## 데이터 흐름

### 오디오 파일 업로드 → 재생

```
파일 드롭 (BasicFileDrop / AudioFileDrop)
  → convertFileToAudioFile()     # AudioFile 객체 생성
  → useTrackStore.addTrack()     # 트랙 생성 + 리전 배치
  → TrackController.addRegion()  # Tone.js Player 바인딩
  → PlaybackControls 클릭
  → PlaybackController.play()    # Tone.Transport.start()
  → 오디오 출력
```

### AI 에이전트 명령 흐름

```
사용자 텍스트 입력 (CommandComposer)
  → useAgent.sendMessage()
  → Web Worker (llm.worker.ts)
  → Qwen2.5-0.5B 로컬 추론
  → aiResponseHandler: JSON 파싱 + Zod 검증
  → useAudioCommand.execute()
  → AudioService 호출 (play/pause/volume/pan/export 등)
  → 상태 업데이트 → UI 리렌더링
```

### CLI 명령 흐름

```
사용자 명령어 입력 (CliTerminal / xterm)
  → createCliCommands 레지스트리에서 매칭
  → AppController (Facade) 호출
  → PlaybackController / TrackController
  → SessionStore + AudioEngine 업데이트
  → UI 반영
```

---

## 라우팅

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | `DropPage` | 파일 업로드 랜딩 페이지 |
| `/daw` | `DawPage` | 메인 DAW UI |
| `/cli-test` | `CliTestPage` | CLI 실험 페이지 |
| `/web-daw` | `WebDAW` | 신규 레이어 기반 DAW (WIP) |

---

## 주요 의존성

### 오디오

| 패키지 | 용도 |
|--------|------|
| `tone` (^15.1.22) | Web Audio 합성 & 재생 엔진 |
| `wavesurfer.js` (^7.10.1) | 오디오 웨이브폼 시각화 |
| `@wavesurfer/react` (^1.0.12) | WaveSurfer React 래퍼 |

### AI/ML

| 패키지 | 용도 |
|--------|------|
| `@mlc-ai/web-llm` (^0.2.80) | 브라우저 로컬 LLM 추론 (Web Worker) |

### React & 상태

| 패키지 | 용도 |
|--------|------|
| `react` (^19.0.0) | UI 프레임워크 |
| `zustand` (^5.0.9) | 경량 상태 관리 |
| `@tanstack/react-query` (^5.62.13) | 서버 상태 관리 |
| `react-router-dom` (^7.10.0) | 클라이언트 라우팅 |

### UI & 스타일

| 패키지 | 용도 |
|--------|------|
| `@radix-ui/*` | 헤드리스 UI 컴포넌트 (Dialog, Dropdown, Tabs 등) |
| `@vanilla-extract/css` (^1.17.4) | 타입 안전 CSS-in-JS |
| `xterm` (^5.3.0) | 터미널 에뮬레이터 (CLI) |
| `react-dropzone` (^14.3.8) | 드래그&드롭 파일 업로드 |

### 검증 & 유틸

| 패키지 | 용도 |
|--------|------|
| `zod` (^4.2.1) | 런타임 스키마 검증 (AI 명령) |
| `es-toolkit` (^1.43.0) | 유틸리티 함수 |
| `react-ga4` (^2.1.0) | Google Analytics 4 |

---

## 구현 완료된 기능

### 1. 오디오 파일 관리

- 드래그&드롭 / 클릭 업로드
- 지원 포맷: MP3, WAV, OGG, FLAC, M4A
- 메타데이터 자동 추출 (duration, fileSize)
- 업로드 시 `/daw`로 자동 이동
- **관련 파일:** `src/components/common/FileDrop/`

### 2. 트랙 관리

- 트랙 추가/제거
- Volume, Pan, Mute, Solo 제어
- 트랙별 리전(오디오 클립) 배치
- **관련 파일:** `src/components/Daw/components/Track/`, `src/layers/controllers/track-controller.ts`

### 3. 재생 제어

- Play / Pause / Stop
- Seek (특정 시간으로 이동)
- BPM 제어 (글로벌 템포)
- Loop 설정 (start/end 시간)
- Master Volume
- **관련 파일:** `src/components/Daw/components/PlaybackControls/`, `src/layers/controllers/playback-controller.ts`

### 4. 타임라인 & 웨이브폼

- TimeRuler (시간 눈금자)
- 재생 커서 (Cursor)
- WaveSurfer.js 기반 웨이브폼 시각화
- 리전 드래그 (moveRegion)
- 리전 분할 (splitRegion) & 리사이즈 (resizeRegion)
- **관련 파일:** `src/components/Daw/components/TimeRuler/`, `RegionComponent.tsx`

### 5. WAV 내보내기

- Tone.Offline 기반 오프라인 렌더링
- 범위 선택 내보내기 (export start/end)
- 트랙 볼륨/팬/뮤트/솔로 반영
- 파일명 커스터마이징
- **관련 파일:** `src/components/Daw/components/ExportButton/`, `src/logics/audio/exportProject.ts`

### 6. AI 에이전트 터미널

- WebLLM (Qwen2.5-0.5B) 브라우저 로컬 추론
- Web Worker에서 실행 (메인 스레드 블로킹 방지)
- 자연어 → JSON 명령 변환 (Zod 스키마 검증)
- 지원 명령: play, pause, stop, set volume, pan, export 등
- 시스템 프롬프트에 현재 트랙/리전/재생 상태 포함
- 채팅 히스토리 + 타임스탬프
- 모델 로딩 오버레이 + 캐시 관리 (purge)
- **관련 파일:** `src/components/Daw/components/Terminals/AgentTerminal/`, `src/hooks/agent/`

### 7. CLI 터미널

- xterm 기반 커맨드라인 인터페이스
- 지원 명령: `play`, `stop`, `pause`, `track`, `region`, `volume`, `pan`, `mute`, `solo`, `bpm`, `loop`, `export`, `status`, `help`, `debug`
- AppController(Facade)를 통한 DAW 제어
- 포매팅된 상태 테이블 출력
- **관련 파일:** `src/layers/apps/cli/`, `src/components/Daw/components/Terminals/CliTerminal/`

### 8. 분석 & 모니터링

- Google Analytics 4 통합 (프로덕션 전용)
- 추적 이벤트: 채팅 메시지 전송, 내보내기, 페이지 이동
- **관련 파일:** `src/utils/analytics.ts`, `src/components/common/AnalyticsTracker.tsx`

### 9. 에러 처리

- GlobalErrorBoundary + 폴백 UI
- 커스텀 에러 타입 (AudioEngineError + 에러 코드)
- TanStack Query 재시도 로직
- **관련 파일:** `src/components/common/ErrorBoundary/`, `src/logics/audio/audioEngine.errors.ts`

---

## 주요 훅 상세

### `useAgent()` — `src/hooks/agent/useAgent/useAgent.ts`

- 채팅 메시지 관리 및 AI 대화 상태
- `sendMessage(content)`: WebLLM 전송 → 응답 파싱 → 명령 실행
- `addMessage()`, `updateMessage()`: 메시지 리스트 관리
- 분석 이벤트 전송, 실행 결과 추적
- 반환: `messages`, `status`, `sendMessage`

### `useWebLLM()` — `src/hooks/agent/useWebLLM.ts`

- Web Worker에서 WebLLM 엔진 초기화
- 싱글턴 패턴: `globalEngine`이 리렌더링 간 유지
- 프로그레스 콜백: 모델 로딩 중 스토어 업데이트
- `purgeCache()`: IndexedDB & Cache API 정리
- 반환: `engine`, `resetEngine`, `purgeCache`

### `useAudioCommand()` — `src/logics/audio/useAudioCommand.ts`

- AI 명령(AudioCommand) → AudioService 브릿지
- `execute(command)`: 명령 타입별 적절한 핸들러 라우팅
- 지원: PLAY, PAUSE, STOP, SET_TRACK_VOLUME, SET_TRACK_PAN, LOAD_REGION, EXPORT_AUDIO 등
- 반환: `execute()`

### `useAudioService()` — `src/presentation/hooks/useAudioService.ts`

- ViewModel 어댑터: React → AudioService Zustand 스토어
- 셀렉터 패턴 지원 (성능 최적화)
- 반환: 전체 AudioSnapshot 또는 선택된 부분

---

## 타입 시스템

### Track & Region — `src/types/track.ts`

```typescript
interface Region {
  id: string;
  startTime: number;
  endTime: number;
  sourceStartTime: number;
  duration: number;
  audioFile: AudioFile;
  status: TrackStatus[];
}

interface Track {
  id: string;
  regions: Region[];
  status: TrackStatus[];
  volume: number;
  pan: number;
}
```

### Audio Command — `src/types/audioCommand.schema.ts`

- Zod 기반 discriminated union (모든 AI 명령 타입)
- 런타임 검증으로 잘못된 응답 방지

### Agent — `src/types/agent.ts`

```typescript
type Role = 'system' | 'user' | 'assistant' | 'tool';
interface Message { id: string; role: Role; content: string; timestamp: number; }
type AgentStatus = 'idle' | 'loading' | 'generating' | 'error';
```

---

## 빌드 & 설정

### Vite (`vite.config.ts`)

- Base URL: 환경변수로 설정 가능
- 플러그인: React, Vanilla Extract
- 경로 별칭: `@/` → `./src/`
- CORS 헤더: `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy` (Web Worker & WebAudio 필수)
- Worker 포맷: ES modules

### 환경변수

| 환경 | 파일 | `VITE_MVP_MODE` | `VITE_GA_ID` |
|------|------|-----------------|--------------|
| Development | `.env.development` | `false` (전체 기능) | - |
| Production | `.env.production` | `true` (MVP만) | `G-KDRYN5L0V5` |

### npm 스크립트

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | Vite 개발 서버 |
| `pnpm build` | TypeScript 체크 + Vite 빌드 |
| `pnpm lint` | ESLint 검증 |
| `pnpm typecheck` | 전체 TypeScript 빌드 체크 |
| `pnpm test` | 단위 + E2E 테스트 |
| `pnpm test:unit` | Vitest 단위 테스트 |
| `pnpm test:e2e` | Playwright E2E 테스트 |

### 배포

- Docker (Dockerfile, docker-compose.yml, nginx.conf)
- Netlify (netlify.toml)

---

## 테스트

| 유형 | 도구 | 위치 | 대상 |
|------|------|------|------|
| 단위 테스트 | Vitest | `*.test.ts` (소스 옆) | 코어 로직, 경계값, 에러 케이스 |
| E2E 테스트 | Playwright | `e2e/` | 실제 오디오 재생 & UI 상호작용 |
| 통합 테스트 | Vitest | `src/layers/integration.test.ts` | 레이어 간 상호작용 (Controller ↔ Session ↔ AudioEngine) |

---

## 미구현 / 개선 필요 사항

### 우선순위 1 — Critical (아키텍처 완성)

| 항목 | 현재 상태 | 위치/비고 |
|------|----------|-----------|
| Legacy → Layers 마이그레이션 완료 | `core/*`와 `layers/*` 병존, App.tsx에서 둘 다 초기화 | 하이브리드 상태 해소 필요 |
| 상태 관리 통합 | 4개 Store 분산 (useTrackStore, usePlaybackStore, SessionStore, AudioService) | 동기화 이슈 가능 |
| WebDAW UI 완성 | `/web-daw` 경로 존재하나 UI 미완성 | `src/layers/apps/web/` |

### 우선순위 2 — High (핵심 기능 보완)

| 항목 | 상태 | 위치/비고 |
|------|------|-----------|
| 프로젝트 저장/불러오기 | 미구현 | persistence layer 없음 (IndexedDB 등 필요) |
| 리전 오버랩 검증 | TODO | `src/core/track/Track.ts:49` |
| 오디오 파일 드롭 시 자동 트랙 추가 | TODO | `src/components/Daw/DawPage.tsx:111` |
| AI 모델 성능 향상 | Qwen2.5-0.5B (매우 작은 모델) | 복잡한 명령 이해도 제한적 |

### 우선순위 3 — Medium (UX 개선)

| 항목 | 상태 | 위치/비고 |
|------|------|-----------|
| 트랙 리스트 디자인 개선 | TODO | `src/components/Daw/components/TrackList.tsx:104` |
| Store 최적화 (변경 트랙만 업데이트) | TODO | `src/stores/useTrackStore.ts:37` |
| 메시지 업데이트 로직 리팩터링 | TODO | `src/hooks/agent/useAgent/useAgent.ts:39` |
| 모바일 대응 | 미구현 | 터치 이벤트, 드래그&드롭 미지원 |
| Undo/Redo | 미구현 | DAW 필수 기능 |
| 키보드 단축키 | 미구현 | DAW UX 필수 |

### 우선순위 4 — Nice to Have

| 항목 | 비고 |
|------|------|
| 이펙트 체인 (EQ, Compressor, Reverb 등) | Tone.js에서 지원 가능 |
| MIDI 지원 | - |
| 협업 기능 (실시간 편집) | 서버 필요 |
| 플러그인 시스템 | IAudioEngine 인터페이스 확장 |

---

## 강점 & 약점

### 강점

- 명확한 레이어 아키텍처 + discipline 문서화
- 강력한 타입 안전성 (TypeScript strict + Zod 런타임 검증)
- 포괄적 테스트 환경 (단위 + E2E + 통합)
- React 19 + 모던 패턴 (hooks, suspense-ready)
- 로컬 AI 추론 (프라이버시 보장, 서버 비용 없음)
- 인터페이스 기반 AudioEngine (교체 가능)

### 약점

- Legacy/New 아키텍처 병존 (마이그레이션 미완료)
- 4개 상태 Store 분산으로 동기화 복잡성
- CLI & WebDAW가 실험적 단계
- 데이터 영속성(persistence) 없음
- 모바일 미지원
- AI 모델 크기 제한 (0.5B → 명령 이해도 한계)

---

*분석 기준일: 2026-04-09*
