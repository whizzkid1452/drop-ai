### 2. AI 에이전트 워크플로우

```mermaid
graph TD
    UserInputMap[사용자 입력 (자연어)] --> AgentTerminal[AgentTerminal (UI)]
    AgentTerminal --> UseAgent[useAgent (메시지/상태 관리)]
    UseAgent --> UseWebLLM[useWebLLM (WebLLM 엔진 호출)]
    UseWebLLM --> LLMWorker[llm.worker.ts (Web Worker 실행)]
    LLMWorker --> AIResponseHandler[AI Response Handler (응답 파싱)]
    AIResponseHandler --> AudioCommand[JSON AudioCommand 생성]
    AudioCommand --> UseAudioHandle[useAudioEngineHandleWithUi (명령어 핸들러)]
    UseAudioHandle --> AudioEngine[AudioEngine (Tone.js 오디오 처리)]
    AudioEngine --> StateUpdate[Zustand Store 업데이트]
    StateUpdate --> UIUpdate[UI Re-render]

    style AgentTerminal fill:#e1f5fe
    style AudioEngine fill:#fff3e0
```

**주요 변경 사항:**

1.  **UI 컴포넌트 명칭**: `AgentInterface` -> `AgentTerminal` (리팩토링 반영)
2.  **명령어 핸들러 추가**: `useAudioEngineHandleWithUi`가 `AudioEngine` 실행 전 연결 고리 역할을 수행함을 명시
