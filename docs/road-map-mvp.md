Mvp 로드맵

제안해주신 기술 스택(React, Vite, Vanilla Extract, Tone.js)과 **"AI Agent를 통한 오디오 편집 및 다운로드"**라는 핵심 목표에 집중하여, 가장 빠르게 검증 가능한 MVP(Minimum Viable Product) 개발 로드맵과 체크리스트를 작성해 드립니다.
MVP의 핵심은 복잡한 기능(멀티 트랙 믹싱, 실시간 협업 등)을 배제하고, **"단일 트랙 업로드 -> AI 대화 -> 편집 실행 -> 다운로드"**의 사이클을 완성하는 것입니다.

🚀 MVP 개발 로드맵 (4주/4단계 계획)
1주차: 핵심 오디오 엔진 및 시각화 (Skeleton)
AI 없이도 사용자가 오디오를 올리고, 보고, 들을 수 있는 기반을 만듭니다.
목표: 파일 업로드, 파형 시각화, 재생/정지 동기화.
구현:
Vite + React + Vanilla Extract 프로젝트 세팅.
Tone.js Player와 WaveSurfer.js 연동 (재생 시 커서 동기화).
Zustand 스토어 구성 (재생 상태, 현재 시간, 로드된 오디오 URL).
2주차: AI 제어 파이프라인 구축 (The Brain)
WebLLM을 통해 브라우저 내에서 LLM이 실제 오디오 엔진을 제어할 수 있도록 연결합니다.
목표: 채팅창에 "소리 좀 키워줘"라고 입력하면 볼륨 노브가 움직이게 하기.
구현:
WebLLM (@mlc-ai/web-llm) 설치 및 엔진 초기화 로직 구현.
모델 로딩 UI: 초기 다운로드 진행률 표시 및 캐싱 상태 관리.
Function Calling 스키마 정의: setVolume, trimAudio, addEffect 등.
Action Dispatcher: LLM이 반환한 JSON({"tool": "setVolume", "val": -6})을 받아 Zustand 상태를 업데이트하는 로직 구현.
WebGPU 리소스 관리: 오디오 재생 중 LLM 추론 일시 중지 또는 배치 처리 전략 구현.
3주차: 오디오 편집 기능 및 DSP 구현 (The Hands)
AI가 호출할 실제 오디오 처리 기능을 Tone.js로 구현합니다.
목표: 자르기(Trim), 볼륨 조절, 기본 이펙트(Reverb, EQ) 적용.
구현:
비파괴 편집(Non-destructive): 실제 파일을 자르는 게 아니라 Player의 startTime과 duration 파라미터만 수정.
이펙트 체인: Player -> Gain -> Reverb -> Destination 형태로 노드 연결.
Undo/Redo: AI가 이상한 짓을 했을 때 되돌릴 수 있도록 Zustand 미들웨어 적용.
4주차: 결과물 렌더링 및 다운로드 (Export)
웹 브라우저에서 편집된 내용을 실제 파일로 만들어냅니다.
목표: 편집된 내용을 WAV/MP3로 다운로드.
구현:
Tone.Offline을 이용해 현재 상태(State)를 고속 렌더링하여 AudioBuffer 생성.
ffmpeg.wasm 또는 audiobuffer-to-wav를 이용해 버퍼를 파일로 인코딩.
최종 QA 및 배포.

✅ MVP 기술 체크리스트
개발 진행 시 이 항목들을 하나씩 지워나가시면 됩니다.
1. 프로젝트 설정 (Setup)
[ ] Vite 설정에 Cross-Origin-Opener-Policy 및 Cross-Origin-Embedder-Policy 헤더 추가 (SharedArrayBuffer 및 WebGPU 사용 대비).1
[ ] Tone.js와 WaveSurfer.js 설치 및 React 컴포넌트화.
[ ] Vanilla Extract 설정 및 기본 테마(Dark Mode 권장) 구성.
[ ] WebLLM (@mlc-ai/web-llm) 설치 및 WebGPU 지원 확인 (chrome://flags).
2. 오디오 엔진 (Audio Engine)
[ ] 파일 로더: 사용자가 업로드한 파일을 ArrayBuffer로 변환하여 Tone.AudioBuffer에 로드.3
[ ] 동기화 로직: Tone.js의 Transport 시간과 WaveSurfer의 seek 기능 양방향 동기화.
[ ] 메모리 관리: 파일 교체 시 기존 Tone.js 노드 dispose() 처리 (메모리 누수 방지).4
3. AI 에이전트 (AI Agent)
[ ] WebLLM 엔진 초기화: CreateMLCEngine을 사용하여 모델 로드 (Llama-3-8B-Instruct-v0.1-q4f32_1-MLC 권장).
[ ] 모델 로딩 UI: 초기 다운로드 진행률 표시 및 IndexedDB 캐싱 상태 관리.
[ ] 도구 정의(Schema): AI에게 알려줄 도구 목록 JSON 작성 (아래 예시 참조).6
[ ] 시스템 프롬프트: "당신은 Tone.js 엔지니어입니다. 사용자의 말을 듣고 적절한 도구를 호출하세요." 설정.
[ ] JSON 파서: AI 응답에서 tool_calls를 안전하게 파싱하여 실행하는 함수 구현.
[ ] 파라미터 검증: AI가 vol: 1000 같은 위험한 값을 줄 경우를 대비해 Zod 등으로 범위 제한.8
[ ] 리소스 스케줄링: 오디오 재생 중 LLM 추론 일시 중지 또는 배치 처리 로직 구현.
4. 편집 및 내보내기 (Editing & Export)
[ ] Trim 기능: Tone.Player의 start(time, offset, duration) 메서드를 이용한 구간 재생 구현.
[ ] Offline Rendering: Tone.Offline 컨텍스트를 생성하고, 현재 오디오 그래프를 복제하여 렌더링하는 함수 구현.9
[ ] WAV 변환: 렌더링된 버퍼를 audiobuffer-to-wav 라이브러리로 Blob 변환 및 다운로드 링크 생성.10

💡 AI 도구(Tool) 정의 예시 (MVP용)
MVP에서는 복잡한 코드 생성 대신, 미리 정의된 함수를 호출하는 방식이 훨씬 안정적입니다.
WebLLM은 OpenAI API와 호환되는 Function Calling 형식을 지원하므로, 동일한 스키마를 사용할 수 있습니다.

JSON
// WebLLM 엔진에 전달할 tools 정의 예시
[
  {
    "type": "function",
    "function": {
      "name": "apply_filter",
      "description": "오디오에 EQ나 필터를 적용합니다 (소리를 먹먹하게 하거나 날카롭게 할 때)",
      "parameters": {
        "type": "object",
        "properties": {
          "frequency": { "type": "number", "description": "컷오프 주파수 (Hz). 기본값 1000" },
          "type": { "type": "string", "enum": ["lowpass", "highpass"], "description": "필터 타입" }
        },
        "required": ["type"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "trim_audio",
      "description": "오디오의 특정 구간만 남기고 자릅니다.",
      "parameters": {
        "type": "object",
        "properties": {
          "start_time": { "type": "number", "description": "시작 시간 (초)" },
          "end_time": { "type": "number", "description": "끝나는 시간 (초)" }
        },
        "required": ["start_time", "end_time"]
      }
    }
  }
]

WebLLM 사용 예시:
```typescript
import * as webllm from "@mlc-ai/web-llm";

const engine = await webllm.CreateMLCEngine("Llama-3-8B-Instruct-v0.1-q4f32_1-MLC");

const messages = [
  { role: "user", content: "소리 좀 키워줘" }
];

const reply = await engine.chat.completions.create({
  messages,
  tools: toolsDefinition, // 위에서 정의한 도구 목록
  tool_choice: "auto"
});

// tool_calls 파싱 및 실행
if (reply.choices[0].message.tool_calls) {
  // 도구 실행 로직
}
```


이 로드맵과 체크리스트를 기반으로 1주차 'Skeleton'부터 시작해 보시는 것을 추천합니다. 특히 오디오 상태(State)를 시각화(UI)와 엔진(Tone.js) 사이에서 어떻게 동기화할지를 먼저 잡는 것이 가장 중요합니다.

