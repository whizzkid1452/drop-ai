# AI 에이전트 개발 가이드라인 및 코딩 규칙 (Drop AI)

이 문서는 Web LLM 기반의 AI Agent 기능을 개발할 때, **안전성(Safety), 일관성(Consistency), 성능(Performance)**을 보장하기 위해 반드시 따라야 할 규칙을 정의합니다.

---

## 1. 아키텍처 원칙: "격리된 두뇌 (Isolated Brain)"

### 규칙 1.1: 메인 스레드 차단 금지 (No Blocking on Main)
*   **원칙**: 모든 AI 추론(Inference) 로직은 반드시 **Web Worker** 내부에서 실행되어야 합니다.
*   **이유**: LLM이 답변을 생성하는 동안 오디오(Tone.js)가 끊기거나 UI가 멈추는 것을 방지하기 위함입니다.
*   **구현**: `useEffect`에서 직접 LLM을 호출하지 말고, `WorkerBridge`를 통해 메시지를 전송하세요.

### 규칙 1.2: 상태 없는 에이전트 (Stateless Agent)
*   **원칙**: AI Worker는 앱의 상태를 영구 저장하지 않습니다.
*   **구현**: 요청(Request)을 보낼 때마다 현재 필요한 **최소한의 컨텍스트(TOON 포맷)**를 함께 주입해야 합니다.
    *   ❌ Bad: "아까 내가 말한 트랙 볼륨 줄여" (AI가 기억 못 할 수 있음)
    *   ✅ Good: "현재 트랙 목록: [Track A(Vol: -5)], 트랙 A의 볼륨을 줄여"

---

## 2. 도구 정의(Tool Definition) 및 안전성

### 규칙 2.1: 실행 코드가 아닌 '데이터'를 반환 (Data over Code)
*   **원칙**: AI는 자바스크립트 코드를 생성하지 않습니다. 오직 **JSON 데이터**만 생성합니다.
*   **금지**: `eval()`, `new Function()` 사용 절대 금지.
*   **예시**:
    *   ❌ AI Output: `player.volume.value = -10;`
    *   ✅ AI Output: `{ "tool": "setVolume", "args": { "val": -10 } }`

### 규칙 2.2: 엄격한 Zod 스키마 검증 (Strict Validation)
*   **원칙**: 메인 스레드는 AI가 보낸 데이터를 절대 신뢰하지 않습니다. 실행 전 반드시 **Zod**로 검증합니다.
*   **구현**:
    ```typescript
    // AI가 볼륨을 1000으로 설정해 스피커를 터뜨리는 것을 방지
    const SetVolumeSchema = z.object({
      trackId: z.string(),
      volume: z.number().min(-60).max(6), // 안전 범위 강제
    });
    ```

---

## 3. 프롬프트 및 통신 프로토콜

### 규칙 3.1: 시스템 프롬프트의 불변성 (Immutability)
*   **원칙**: 시스템 프롬프트는 에이전트의 '인격'과 '제약사항'을 정의하는 가장 중요한 코드입니다. 하드코딩하지 말고 별도 상수 파일로 관리하세요.
*   **팁**: 작은 모델(Phi-3 등)을 위해 지시는 **짧고 명확한 영어**로 작성하는 것이 토큰 효율과 인식률 면에서 유리합니다. (사용자 대화는 한국어로 하더라도, 내부 지침은 영어 권장)

### 규칙 3.2: 함수 호출 응답 처리 (Return-to-Agent)
*   **원칙**: AI가 도구를 호출하면, 그 결과를 반드시 AI에게 다시 알려줘야 합니다.
*   **Cycle**:
    1.  User: "재생해"
    2.  Agent: `call tool: play()`
    3.  System: `execute play()` -> `return: "Started playing at 0:00"`
    4.  Agent: (사용자에게) "재생을 시작했습니다."

---

## 4. 디렉토리 구조 및 네이밍

*   **`src/workers/llm`**: Web Worker 관련 로직 (엔진 초기화, 메시지 핸들링)
*   **`src/logics/ai/prompts`**: 시스템 프롬프트 및 퓨샷 예제 모음
*   **`src/logics/ai/tools`**: AI가 사용할 도구 정의 및 스키마 (Zod)
*   **`src/types/agent.ts`**: AI 메시지 타입 (`UserMessage`, `AgentMessage`, `ToolMessage`)

---

## 5. 성능 최적화 (WebGPU)

### 규칙 5.1: 모델 캐싱 및 로딩 상태 표시
*   **원칙**: 모델(2GB+)은 사용자의 캐시 스토리지에 저장되어야 하며, 재방문 시 즉시 로드되어야 합니다.
*   **UI**: 모델 로딩 중에는 "AI 준비 중..." 같은 명확한 인디케이터를 상단에 노출해야 합니다.

### 규칙 5.2: 컨텍스트 윈도우 관리
*   **원칙**: 브라우저 메모리는 한정적이므로, 대화 내역이 길어지면 **오래된 대화부터 요약하거나 삭제(Truncate)**해야 합니다.