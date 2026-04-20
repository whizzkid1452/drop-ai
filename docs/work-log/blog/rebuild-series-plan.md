# Drop-AI 재구축 블로그 시리즈 기획안

## Goal

이 시리즈의 목표는 Drop-AI를 처음부터 다시 만들면서, 독자가 단계별로 따라와서 동작하는 Web DAW MVP를 완성하도록 돕는 것이다.  
최종적으로 독자는 `Apps → Controllers → Session/AudioEngine` 구조를 이해하고, Web UI와 CLI에서 동일한 도메인 로직을 재사용할 수 있다.

## Prerequisites

- Node.js 22+
- pnpm 9+
- TypeScript 기본 문법
- React 기본 사용 경험
- 브라우저 오디오 정책(사용자 제스처 이후 재생 시작) 기초 이해

## 시리즈 구성 원칙

- 한 편마다 결과물이 있어야 한다.
- 설계와 구현을 분리하되, 항상 실행 가능한 코드로 검증한다.
- 도메인 로직은 UI보다 먼저 고정한다.
- 테스트(단위 테스트)를 먼저 작성하고 구현으로 닫는다.
- 글마다 "왜 이 순서인지"를 명확히 설명한다.

## 핵심 철학: 사고의 흐름으로 쓴다

블로그 글은 **결과의 나열이 아니라 사고의 여정**이다.  
독자가 "왜 이 선택을 했는가"를 따라갈 수 있어야 한다.

- **What(무엇)보다 Why(왜)와 How(어떻게 생각했는가)** 에 집중한다.
- 선택지가 여러 개 있었다면, 각 선택지를 비교하고 **왜 그것을 골랐는지** 밝힌다.
- 독자가 같은 상황에서 스스로 판단할 수 있는 **사고 프레임워크**를 제공한다.
- "이렇게 했다"가 아니라 "이런 상황에서 이런 제약 조건이 있었고, 이런 이유로 이 방향을 선택했다"로 쓴다.

## Step-by-Step Guide

### 1. 문제 정의와 범위 설정

핵심 질문부터 고정한다.

- 무엇을 "완성"으로 볼 것인가?
- 어떤 기능을 MVP로 자를 것인가?
- 어떤 기능은 후순위로 미룰 것인가?

MVP 기능 예시:

- 재생/정지/일시정지
- BPM/루프/마스터 볼륨
- 트랙 추가/삭제, 트랙 볼륨/팬/mute/solo
- 리전 추가/이동/삭제/분할/리사이즈
- 세션 내보내기(WAV)

결과물:

- 기능 우선순위 표
- 사용자 시나리오(최소 3개)

### 2. 아키텍처 설계

레이어 규칙을 먼저 정의한다.

- Apps는 상태를 읽고, 액션은 Controller를 통해 전달한다.
- Controllers는 AudioEngine에 명령하고 Session을 갱신한다.
- Session은 UI 표시 상태의 단일 출처다.
- 객체 조립은 `createApp`에서만 수행한다.

결과물:

- 레이어 의존 다이어그램
- 금지 의존성 목록

### 3. 세션 모델 설계

세션 타입과 액션을 고정한다.

- `SessionData`: `isPlaying`, `bpm`, `isLooping`, `tracks` 등
- `SessionActions`: `setPlaying`, `addTrack`, `addRegion` 등

주의사항:

- `Map`과 배열 업데이트는 불변성 기준으로 처리한다.
- 리전/트랙 변경은 모두 세션 액션을 통해서만 일어난다.

결과물:

- Zustand store 구현
- 세션 액션 단위 테스트

### 4. AudioEngine 인터페이스 설계

구현보다 계약을 먼저 만든다.

- `play`, `stop`, `pause`
- `loadFile`, `createTrack`, `addRegion`, `moveRegion`
- `setBpm`, `setLoop`, `exportSession`

결과물:

- `IAudioEngine` 인터페이스
- Mock 엔진으로 동작하는 테스트 환경

### 5. PlaybackController 구현

재생 도메인부터 구현한다.

구현 규칙:

- AudioEngine 호출 후 Session 반영 순서를 일관되게 유지
- 에러 처리 메시지와 경계값 정책(BPM > 0 등) 고정

결과물:

- Play/Stop/Pause/Seek/Loop/BPM/MasterVolume 구현
- 단위 테스트(정상/예외/경계값)

### 6. TrackController 구현

트랙/리전 도메인을 구현한다.

- `addTrack`, `removeTrack`
- `addRegion`, `moveRegion`, `removeRegion`
- `splitRegion`, `resizeRegion`

결과물:

- 트랙/리전 제어 기능
- 도메인 예외 테스트(존재하지 않는 트랙, 잘못된 split 시각 등)

### 7. Composition Root와 Context 연결

`createApp(engine)`로 객체 그래프를 조립하고 React에 주입한다.

- `LayerProvider`
- `useController`
- `useSession`

결과물:

- UI에서 읽기/쓰기 경로 분리 완료

### 8. Web UI 구축

웹 화면에서 핵심 조작을 붙인다.

- Transport 컴포넌트
- TrackList와 TrackItem
- 타임라인은 초기에 Placeholder로 두고 인터랙션 먼저 안정화

결과물:

- 브라우저에서 기본 DAW 조작 가능

### 9. CLI UI 구축

같은 Controller를 CLI에서도 사용한다.

- `status`, `track`, `region`, `seek`, `loop`, `bpm`, `export`

결과물:

- UI가 달라도 도메인 로직 재사용이 가능함을 증명

### 10. 내보내기, 테스트, 배포

- Tone Offline 렌더링 + WAV 인코딩
- `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` 검증
- 배포 문서화

결과물:

- "실제로 배포 가능한 MVP" 완료

## 각 편 템플릿

```md
# [글 제목]

## Goal
[이번 편에서 독자가 얻는 것]

## Prerequisites
- [필요 환경]

## Step-by-Step Guide
### [Step 1]
[설명 + 실행 코드]

### [Step 2]
[설명 + 실행 코드]

## Verify Final Result
[검증 방법과 기대 결과]

## FAQ
### [질문 1]
[답변]
```

## 에피소드별 체크리스트

- 각 편 종료 시 실행 가능한 상태인가?
- 테스트 코드가 최소 1개 이상 추가되었는가?
- 이전 편 지식이 다음 편의 전제가 되도록 흐름이 자연스러운가?
- 마지막에 독자가 "직접 확인"할 명령이 포함되어 있는가?

## Verify Final Result

다음 순서로 시리즈 품질을 검증한다.

1. 초안 10편의 제목과 목표를 먼저 확정한다.
2. 각 편의 결과물을 한 줄로 정의한다.
3. 코드 레포에서 태그 또는 브랜치로 편별 스냅샷을 남긴다.
4. 독자 입장에서 1편부터 10편까지 재현해 보고 누락 단계를 보완한다.
