# AI 에이전트 구현 계획

## 목표 (Goal)
`@mlc-ai/web-llm`을 활용하여 브라우저 내에서 완벽하게 실행되는 **ReAct (Reasoning + Acting)** AI 에이전트를 구현합니다. 사용자의 자연어 명령을 해석하여 `AudioEngine`을 제어하고 DAW 기능을 수행하는 것이 목표입니다.

## 아키텍처 (Architecture)

### 1. 핵심 에이전트 로직 (`src/logics/ai/`)
- **`Agent` 클래스**: LLM 모델의 수명 주기(로드, 리로드)를 관리하고, 대화 기록을 유지하며, ReAct 루프를 실행합니다.
- **`Tools` (도구)**: `AudioEngine`의 기능(재생, 일시정지, 트랙 추가 등)을 에이전트가 사용할 수 있는 형태로 래핑한 도구 레지스트리입니다.
- **`Prompt Engineering` (프롬프트 엔지니어링)**: 에이전트의 페르소나, 사용 가능한 도구, 그리고 ReAct 출력 형식(생각 -> 행동 -> 관찰)을 정의하는 강력한 시스템 프롬프트를 구축합니다.

### 2. 상태 관리 (State Management)
- **`zustand`**를 사용하여 에이전트의 상태(모델 로딩 중, 생각 중, 채팅 기록 등)를 관리하여 UI에 쉽게 반영할 수 있도록 합니다.

### 3. UI 통합 (UI Integration)
- 기존 `CliInterface.tsx`를 대체하거나 업그레이드하여 다음 기능을 지원합니다:
    - 자연어 입력 창.
    - **"Thought Process" (사고 과정)** 표시: 에이전트가 어떤 도구를 왜 선택했는지 사용자에게 보여줍니다.
    - 최종 응답 표시.
    - 모델 다운로드 진행률 표시 (WebLLM 특성상 초기 로딩이 중요함).

## 변경 제안 확인 (Proposed Changes)

### 로직 레이어 (Logic Layer)

#### [NEW] `src/logics/ai/types.ts`
- `AgentMessage`, `Tool`, `ToolExecutionResult` 인터페이스 정의.

#### [NEW] `src/logics/ai/prompt.ts`
- 시스템 프롬프트 및 ReAct 템플릿 정의.

#### [NEW] `src/logics/ai/tools/audioTools.ts`
- `AudioEngine.getInstance().execute()`를 호출하는 도구 함수들 구현.

#### [NEW] `src/logics/ai/agent.ts`
- **클래스**: `ReActAgent`
- **메서드**:
    - `initialize()`: WebLLM 모델 로드.
    - `chat(userInput)`: 메인 루프. (생각 생성 -> 액션 감지 -> 도구 실행 -> 관찰 결과 피드백 -> 반복 -> 최종 답변).

### 스토어 레이어 (Store Layer)

#### [NEW] `src/stores/useAgentStore.ts`
- 관리할 상태: `messages`, `isModelLoading`, `loadingProgress` (다운로드 % 확인용), `isThinking` (UI 스피너용).

### UI 레이어 (UI Layer)

#### [MODIFY] `src/components/Daw/components/CliInterface.tsx`
- **리팩토링**: 단순 명령어 입력기를 채팅형 인터페이스로 변경.
- **추가**: 모델 로딩 진행률 바 (Progress Bar).
- **추가**: 메시지 타입을 구분하여 표시 (유저, 에이전트 생각, 도구 실행 결과, 에이전트 답변).

## 검증 계획 (Verification Plan)

### 수동 검증 (Manual Verification)
1.  **모델 로딩 테스트**: 브라우저 진입 시 모델이 정상적으로 다운로드되고 VRAM에 로드되는지 확인.
2.  **단순 명령 테스트**: "음악 재생해줘" 입력 -> 에이전트가 `PLAY` 도구 호출 -> 오디오 재생 확인.
3.  **복합 명령 테스트**: "새 트랙 추가하고 볼륨 50%로 줄여줘" -> 에이전트가 `ADD_TRACK` 후 `SET_VOLUME` 순차 실행 확인.
4.  **에러 핸들링**: 존재하지 않는 트랙 제어 시도 시 -> 에이전트가 에러 메시지를 이해하고 사용자에게 설명하는지 확인.

## 기술적 의존성 (Technical Dependencies)
- `@mlc-ai/web-llm`: 이미 설치되어 있음.
- **모델**: `Llama-3-8B-Instruct-q4f32_1` (또는 브라우저에 최적화된 경량 모델)을 기본값으로 설정.
