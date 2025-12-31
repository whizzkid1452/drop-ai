1. 인프라 및 보안 설정 (Infrastructure & Security Rules)
   목표: WebLLM(WebGPU)과 FFmpeg.wasm(SharedArrayBuffer)이 브라우저에서 차단되지 않고 최고 성능을 내도록 보장.

** COOP/COEP 헤더 강제 설정 (Non-negotiable)**

SharedArrayBuffer를 사용하려면 사이트가 "Cross-Origin Isolated" 상태여야 합니다.

Vite 설정 (vite.config.ts): 개발 서버와 프리뷰 서버 모두에 아래 헤더를 필수적으로 포함해야 합니다.

TypeScript

headers: {
"Cross-Origin-Opener-Policy": "same-origin",
"Cross-Origin-Embedder-Policy": "require-corp",
}
주의: 이 설정이 적용되면 외부 이미지(CDN) 로딩이 차단될 수 있습니다. 모든 <img> 태그에 crossOrigin="anonymous" 속성을 추가하거나, 외부 리소스 서버가 CORS 헤더를 올바르게 보내는지 확인해야 합니다.

** AI 연산의 메인 스레드 격리**

WebLLM이 GPU를 사용하더라도, 모델 로딩과 텍스트 디코딩 로직은 자바스크립트 메인 스레드를 점유하여 UI를 멈추게 할 수 있습니다.

규칙: CreateMLCEngine 및 추론 로직은 반드시 Web Worker 내부에서 실행하고, React와는 postMessage 또는 Comlink로 비동기 통신해야 합니다.

2. 상태 관리 및 Tone.js 동기화 (State & Audio Sync Rules)
   목표: React의 리렌더링이 오디오 재생에 끊김(Glitch)을 유발하지 않도록 방어.

** Tone.js 객체의 useRef 캡슐화**

금지: useState에 Tone.js 객체(Synth, Player)를 저장하지 마십시오. React의 불변성 원칙과 Tone.js의 가변적 성격이 충돌합니다.

규칙: 모든 오디오 노드는 useRef 또는 외부 Store에 저장하고, React는 오직 UI 상태(볼륨 수치, 재생 여부 텍스트)만 관리합니다.

** 이중 상태 아키텍처 (Dual-State Architecture)**

시스템은 두 가지 '진실 공급원'을 가집니다.

Audio Truth: Tone.Transport.position (실제 오디오 시간)

Visual Truth: Zustand Store (UI에 표시되는 시간)

동기화 규칙: UI에서 재생 버튼을 누르면 -> Zustand 상태 변경 -> useEffect가 감지 -> Tone.Transport.start() 호출 순서로 단방향 데이터 흐름을 유지합니다. 역방향(오디오 진행 -> UI 바 업데이트)은 Tone.Draw.schedule을 사용하여 requestAnimationFrame과 동기화해야 합니다.

3. AI 에이전트 및 프롬프트 엔지니어링 (AI Engineering Rules)
   목표: 로컬 LLM(Hermes/Llama-3)의 환각을 방지하고 정확한 JSON 명령을 유도.

** Zod 기반의 런타임 스키마 검증**

AI는 언제든 잘못된 JSON(예: 닫히지 않은 괄호, 존재하지 않는 파라미터)을 뱉을 수 있습니다.

규칙: AI의 모든 출력은 실행 전 반드시 Zod Schema로 safeParse 해야 합니다. 검증 실패 시, 에러 메시지를 포함하여 AI에게 재시도를 요청하는 자동 복구(Self-Correction) 루프를 구현하십시오.

** 컨텍스트 윈도우 관리 (State Summarization)**

DAW의 상태(트랙 20개, 각 트랙의 이펙트 등)는 토큰을 많이 차지합니다.

규칙: 전체 상태를 그대로 프롬프트에 넣지 마십시오. AI에게는 **'요약된 그림자 상태(Shadow State)'**만 전달해야 합니다.

Bad: 오디오 버퍼 데이터 전체 전송.

Good: [{id: "track-1", type: "synth", effects: ["reverb"]}] 형태의 메타데이터만 전송.

** Hermes 모델 전용 프롬프트 템플릿**

선정하신 Hermes 모델은 <tool_call> XML 태그를 사용하는 특유의 포맷이 있습니다.

규칙: WebLLM의 기본 템플릿에 의존하지 말고, 시스템 프롬프트에 Hermes 전용 XML 구조를 명시적으로 주입하여 도구 호출의 정확도를 높여야 합니다.

4. 성능 최적화 (Performance Rules)
   ** 과도적 업데이트 (Transient Updates) 패턴**

오디오 레벨 미터나 재생 헤드처럼 초당 60회 변하는 데이터는 React 리렌더링을 유발하면 안 됩니다.

규칙: Zustand의 subscribe 메서드를 사용하여 React 컴포넌트 리렌더링을 우회하고, ref를 통해 DOM을 직접 조작(Direct DOM Manipulation) 하십시오.

** 오디오 리소스의 명시적 해제 (Dispose Pattern)**

규칙: 트랙을 삭제하거나 프로젝트를 닫을 때, 반드시 해당 트랙에 연결된 Tone.js 노드들의 .dispose() 메서드를 호출해야 합니다. 그렇지 않으면 메모리 누수뿐만 아니라, 브라우저 백그라운드에서 오디오 처리가 계속되어 CPU를 점유합니다.
