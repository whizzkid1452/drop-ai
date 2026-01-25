# Drop.ai 프로젝트 전체 구조 설명

## 📋 프로젝트 개요

**Drop.ai**는 AI 기반 웹 디지털 오디오 워크스테이션(DAW)입니다. 사용자가 자연어로 오디오를 편집하고, 브라우저에서 직접 오디오 파일을 처리할 수 있는 웹 애플리케이션입니다.

### 핵심 기술 스택

- **프론트엔드**: React 19 + TypeScript
- **빌드 도구**: Vite 7
- **스타일링**: Vanilla Extract (Zero-runtime CSS-in-JS)
- **상태 관리**: Zustand
- **오디오 엔진**: Tone.js
- **파형 시각화**: WaveSurfer.js
- **AI 모델**: WebLLM (클라이언트 사이드 LLM 실행)
- **라우팅**: React Router v7
- **데이터 페칭**: TanStack Query

---

## 🏗️ 프로젝트 구조

```
drop-ai/
├── src/
│   ├── components/          # React 컴포넌트
│   │   ├── common/          # 공통 컴포넌트
│   │   │   └── FileDrop/    # 파일 드롭 영역
│   │   ├── Daw/             # DAW 메인 페이지
│   │   │   ├── components/  # DAW 서브 컴포넌트
│   │   │   │   ├── AgentInterface/    # AI 에이전트 UI
│   │   │   │   ├── Track/             # 트랙 컴포넌트
│   │   │   │   ├── TrackList/         # 트랙 리스트
│   │   │   │   ├── TimeRuler/         # 타임라인 눈금
│   │   │   │   ├── PlaybackControls/  # 재생 컨트롤
│   │   │   │   └── ExportButton/      # 내보내기 버튼
│   │   │   └── DawPage.tsx
│   │   └── Drop/            # 파일 업로드 페이지
│   │       └── DropPage.tsx
│   │
│   ├── stores/              # Zustand 상태 관리
│   │   ├── useTrackStore.ts      # 트랙 상태
│   │   ├── usePlaybackStore.ts   # 재생 상태
│   │   ├── useAudioFileStore.ts  # 오디오 파일 상태
│   │   └── useAgentStore.ts      # AI 에이전트 상태
│   │
│   ├── hooks/                # 커스텀 훅
│   │   └── agent/
│   │       ├── useAgent/          # AI 에이전트 메인 훅
│   │       ├── useWebLLM.ts       # WebLLM 초기화
│   │       └── useAudioEngineHandleWithUi.ts  # 오디오 엔진 연동
│   │
│   ├── logics/               # 비즈니스 로직
│   │   └── audio/
│   │       ├── audioEngine.ts         # Tone.js 오디오 엔진
│   │       ├── convertFileToAudioFile.ts
│   │       ├── exportProject.ts       # 프로젝트 내보내기
│   │       ├── getAudioMetadata.ts
│   │       └── loadAndDecodeAudioBuffer.ts
│   │
│   ├── types/                # TypeScript 타입 정의
│   │   ├── track.ts
│   │   ├── audioFile.ts
│   │   ├── agent.ts
│   │   └── audioCommand.schema.ts
│   │
│   ├── utils/                # 유틸리티 함수
│   │   ├── audio/
│   │   └── hardwareInfo.ts
│   │
│   ├── workers/              # Web Workers
│   │   └── llm.worker.ts     # LLM 처리 워커
│   │
│   ├── styles/               # 전역 스타일
│   │   └── global.css.ts
│   │
│   ├── router/               # 라우팅 설정
│   │   └── AppRouter.tsx
│   │
│   ├── App.tsx               # 루트 컴포넌트
│   └── main.tsx              # 진입점
│
├── docs/                     # 문서
├── records/                  # 개발 기록
├── public/                   # 정적 파일
├── dist/                     # 빌드 결과물
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 🔄 데이터 흐름 및 아키텍처

### 1. 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        브라우저 환경                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              React UI Layer                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │
│  │  │  DropPage    │  │   DawPage    │  │  Layout   │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                    │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Zustand State Management                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │  Track   │  │ Playback │  │  Agent   │           │   │
│  │  │  Store   │  │  Store   │  │  Store   │           │   │
│  │  └──────────┘  └──────────┘  └──────────┘           │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                    │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Custom Hooks Layer                            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │ useAgent │  │ useWebLLM│  │useAudio  │           │   │
│  │  │          │  │          │  │ Engine   │           │   │
│  │  └──────────┘  └──────────┘  └──────────┘           │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                    │                    │         │
│         ▼                    ▼                    ▼         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  AudioEngine │    │  WebLLM      │    │  WaveSurfer  │  │
│  │  (Tone.js)   │    │  (Worker)    │    │  (Visualize) │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │         │
│         └────────────────────┴────────────────────┘         │
│                          │                                    │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Web Audio API                            │   │
│  │         (Browser Native API)                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 2. AI 에이전트 워크플로우

```
사용자 입력 (자연어)
    │
    ▼
┌─────────────────┐
│  AgentInterface │  ──► UI에서 메시지 입력
└─────────────────┘
    │
    ▼
┌─────────────────┐
│   useAgent      │  ──► 메시지 관리 및 상태 업데이트
└─────────────────┘
    │
    ▼
┌─────────────────┐
│   useWebLLM     │  ──► WebLLM 엔진 호출
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  llm.worker.ts  │  ──► Web Worker에서 LLM 실행
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ AI Response     │  ──► JSON 형태의 AudioCommand 생성
│ Handler         │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ AudioEngine     │  ──► Tone.js를 통한 오디오 처리
│ (Tone.js)       │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ State Update    │  ──► Zustand Store 업데이트
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ UI Re-render    │  ──► React 컴포넌트 업데이트
└─────────────────┘
```

### 3. 오디오 처리 파이프라인

```
오디오 파일 업로드
    │
    ▼
┌─────────────────┐
│ File → ArrayBuffer │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ AudioContext    │  ──► 디코딩
│ decodeAudioData │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ AudioFile       │  ──► 메타데이터 추출
│ (Metadata)      │      (duration, size, etc.)
└─────────────────┘
    │
    ├─────────────────┬─────────────────┐
    ▼                 ▼                 ▼
┌─────────┐    ┌──────────────┐    ┌──────────┐
│TrackStore│   │ WaveSurfer   │    │Tone.Player│
│ (State) │    │ (Visualize)  │    │ (Play)   │
└─────────┘    └──────────────┘    └──────────┘
    │                 │                 │
    └─────────────────┴─────────────────┘
                      │
                      ▼
              ┌──────────────┐
              │ AudioEngine  │
              │ (Tone.js)    │
              └──────────────┘
                      │
                      ▼
              ┌──────────────┐
              │ Web Audio API│
              │ (Browser)    │
              └──────────────┘
```

### 4. 컴포넌트 계층 구조

```
App
│
├── DefaultLayout
│   │
│   └── BrowserRouter
│       │
│       └── AppRouter
│           │
│           ├── Route: "/"
│           │   └── DropPage
│           │       └── AudioFileDrop
│           │
│           └── Route: "/daw"
│               └── DawPage
│                   │
│                   ├── DawHeader
│                   │
│                   ├── TimeRuler
│                   │
│                   ├── TrackList
│                   │   └── TrackComponent (반복)
│                   │       ├── TrackHeader
│                   │       ├── TrackVolumeController
│                   │       ├── TrackPanController
│                   │       └── WaveSurfer (파형)
│                   │
│                   ├── PlaybackControls
│                   │
│                   ├── TrackInfoSidebar
│                   │
│                   └── AgentInterface
│                       ├── MessageList
│                       ├── InputArea
│                       ├── ActionButtons
│                       └── LoadingOverlay
```

---
