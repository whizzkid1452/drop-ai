# AI 에이전트 구현 현황 및 계획 (2026-01-01)

## 개요 (Overview)

`@mlc-ai/web-llm`을 활용하여 브라우저 내에서 실행되는 로컬 AI 에이전트를 구현 중입니다.
현재 **ReAct (Reasoning + Acting)** 구조를 기반으로 자연어 명령을 해석하여 DAW(`AudioEngine`)를 제어하는 기능이 구현되어 있습니다.

## 현재 아키텍처 (Current Architecture)

### 1. 로직 및 상태 관리 (Logic & State)

기존 계획의 클래스 기반(`src/logics/ai/`) 접근 방식에서 **React Hooks + Zustand** 기반으로 변경되었습니다.

- **Hook: `useAgent`** (`src/hooks/agent/useAgent/useAgent.ts`)
  - 에이전트의 메인 진입점.
  - **채팅 상태 관리**: `messages`, `status`는 Hook 내부 `useState`로 지역적으로 관리 (UI 업데이트 최적화).
  - **메시지 흐름**: 유저 입력 -> LLM 요청 -> 응답 파싱 -> 오디오 커맨드 실행 -> UI 업데이트.

- **Store: `useAgentStore`** (`src/stores/useAgentStore.ts`)
  - **모델 로딩 상태 관리**: `isModelReady`, `modelLoadingProgress` 등 전역적으로 필요한 모델 상태만 관리.

- **Hook: `useWebLLM`** (`src/hooks/agent/useWebLLM.ts`)
  - WebLLM 엔진 초기화 및 모델 로딩 담당.

### 2. 도구 실행 (Tool Execution)

- **`AudioEngine`**: 실제 오디오 처리 로직 담당.
- **Hook: `useAudioEngineHandleWithUi`** (`src/hooks/agent/useAudioEngineHandleWithUi.ts`)
  - `AudioEngine` 실행 결과에 따라 Zustand Store(`usePlaybackStore`, `useTrackStore`)를 업데이트하여 UI와 오디오 상태를 동기화.
  - 지원 명령: `PLAY`, `PAUSE`, `STOP`, `SET_TRACK_VOLUME`, `SET_TRACK_PAN` 등.

### 3. 유틸리티 (Utils) (`src/hooks/agent/useAgent/utils/`)

- `aiResponseHandler.ts`: LLM 응답을 해석하고 도구를 호출하는 핵심 로직.
- `queryToLLM.ts`: LLM에 프롬프트를 전송하고 응답을 받는 래퍼.
- `getSystemPrompt.ts`: 에이전트의 페르소나 및 도구 정의가 포함된 시스템 프롬프트 생성.

## 구현 상태 (Implementation Status)

### 완료된 항목 (Completed)

- [x] **WebLLM 연동**: 브라우저 내 모델 로드 및 추론 기능 (`useWebLLM`).
- [x] **기본 에이전트 루프**: 사용자 입력 -> LLM -> 커맨드 실행 구조 (`useAgent`).
- [x] **오디오 제어 도구**: 재생, 정지, 볼륨, 팬 조절 기능 연동 (`useAudioEngineHandleWithUi`).
- [x] **시스템 프롬프트**: JSON 포맷의 커맨드 출력을 위한 프롬프트 엔지니어링 (`getSystemPrompt`).
- [x] **상태 관리 분리**: 채팅 상태(Local)와 모델 상태(Global) 분리 완료.

### 진행 중 / 예정 (In Progress / Todo)

- [ ] **에러 복구 및 피드백**: LLM이 잘못된 JSON을 출력하거나 명령 수행 실패 시 재시도 로직 고도화.
- [ ] **복합 명령 처리 강화**: 한 번의 발화로 여러 트랙 제어 또는 순차적 작업 수행 능력 검증.
- [ ] **UI/UX 개선**:
  - `CliInterface`를 완전한 채팅 UI로 고도화.
  - 사고 과정(Thought Process)과 실행 결과(Action Output)를 더 명확하게 시각화.
  - 모델 로딩 중 초기 사용자 경험 개선.
- [ ] **컨텍스트 관리 개선**: 긴 대화 시 토큰 제한 관리 및 이전 대화 요약 기능.

## 파일 구조 매핑 (File Structure Mapping)

| 역할          | 기존 계획 (Deprecated)              | 현재 구현 (Current)                                              |
| ------------- | ----------------------------------- | ---------------------------------------------------------------- |
| **메인 로직** | `src/logics/ai/agent.ts`            | `src/hooks/agent/useAgent/useAgent.ts`                           |
| **도구 정의** | `src/logics/ai/tools/`              | `src/hooks/agent/useAudioEngineHandleWithUi.ts`                  |
| **프롬프트**  | `src/logics/ai/prompt.ts`           | `src/hooks/agent/useAgent/utils/getSystemPrompt.ts`              |
| **상태 관리** | `src/stores/useAgentStore.ts` (All) | `src/stores/useAgentStore.ts` (Loading only) + `useAgent` (Chat) |
| **타입 정의** | `src/logics/ai/types.ts`            | `src/types/agent.d.ts`, `src/types/audioCommand.schema.ts`       |
