# 프로젝트 개발 규칙

## 목적

새 기능을 Web UI, 내부 CLI, Agent Chat에서 같은 방식으로 실행한다.
프로젝트 상태와 오디오 동작을 변경하는 기능은 반드시 `AudioCommand`, `CommandExecutor`, `Controller`를 거친다.

## 기준 문서

- 아키텍처 규칙: [`src/layers/architecture.md`](src/layers/architecture.md)
- 아키텍처 설명: [`docs/architecture.md`](docs/architecture.md)
- 코드 작성 원칙: [`src/principal.md`](src/principal.md)

구현 전에 위 문서를 확인한다. 구현과 문서가 충돌하면 임의로 예외를 만들지 않고, 아키텍처 문서와 구현을 같은 변경에서 맞춘다.
`docs/mvp_goal.md`와 `docs/REBUILD_PLAN.md`는 계획 문서이며 현재 아키텍처 규칙보다 우선하지 않는다.

## 필수 실행 경로

```text
Web UI / CLI / Agent Chat
  → AudioCommand
  → CommandExecutor
  → AppController의 하위 Controller
  → Session / IAudioEngine
  → Tone.js / Web Audio
```

각 계층의 책임은 다음과 같다.

| 계층            | 책임                                              |
| --------------- | ------------------------------------------------- |
| Apps            | 입력을 `AudioCommand`로 변환하고 결과를 표시한다. |
| CommandExecutor | Zod로 명령을 검증하고 실행 순서를 관리한다.       |
| Controllers     | Session 변경과 AudioEngine 호출을 조정한다.       |
| Session         | 화면에 표시할 상태를 저장한다.                    |
| AudioEngine     | 오디오 처리와 Tone.js·Web Audio 접근을 담당한다.  |

## 금지 사항

- 새 기능에서 Apps가 Controller를 직접 호출하지 않는다.
- Apps가 프로젝트·트랙·리전·재생·내보내기 상태를 직접 변경하지 않는다.
- Apps와 CommandExecutor가 AudioEngine을 직접 호출하지 않는다.
- Controllers 밖에서 `IAudioEngine` 구현체를 사용하지 않는다.
- AudioEngine 밖에서 Tone.js 또는 Web Audio API를 사용하지 않는다.
- Web UI, CLI, Agent에 같은 비즈니스 로직을 각각 복사하지 않는다.
- Agent Prompt에만 명령을 추가하고 Schema나 실행기를 누락하지 않는다.
- 기존의 직접 Controller 호출을 새 코드의 허용 사례로 간주하지 않는다. 해당 호출은 점진적으로 Command 경로로 이전한다.

## 허용되는 직접 접근

- Apps는 `useSession` selector로 Session을 읽을 수 있다.
- 모달 열림, 입력값, hover처럼 화면에만 필요한 상태는 React 로컬 상태로 관리할 수 있다.
- Agent 메시지, 모델 로딩 상태처럼 오디오·프로젝트 도메인을 변경하지 않는 앱 워크플로 상태는 Session Action으로 변경할 수 있다.
- 조회 전용 CLI 명령은 Session snapshot을 읽을 수 있다.

위 예외가 프로젝트 데이터나 오디오 결과를 변경하면 예외가 아니며 Command와 Controller를 추가해야 한다.

## 기능 추가 순서

### 1. Command 정의

[`src/layers/shared/types/audioCommand.schema.ts`](src/layers/shared/types/audioCommand.schema.ts)에 다음 내용을 추가한다.

1. `AudioCommandType` 상수
2. Zod discriminated union 항목
3. 필드 범위와 필수값 검증

Prompt나 UI보다 Schema를 먼저 추가한다. 검증되지 않은 입력은 Controller에 전달하지 않는다.

### 2. Controller 구현

- 기존 책임과 맞으면 기존 Controller에 메서드를 추가한다.
- 새로운 책임이면 kebab-case 파일로 Controller를 만들고 `AppController`에 등록한다.
- Controller가 Session 변경과 AudioEngine 호출 순서를 결정한다.
- 오디오 기능은 먼저 `IAudioEngine` 인터페이스에 선언하고 구현체와 Mock을 함께 수정한다.

### 3. CommandExecutor 연결

[`src/layers/commands/command-executor.ts`](src/layers/commands/command-executor.ts)의 분기에 Command를 등록한다.

- 검증된 Command만 처리한다.
- 실행 시점에 필요한 Session 상태만 읽는다.
- 실제 동작은 Controller에 위임한다.
- 여러 Command는 입력 순서를 유지해 순차 실행한다.

### 4. Composition Root 등록

새 의존성이 필요하면 [`src/layers/apps/create-app.ts`](src/layers/apps/create-app.ts)에서 한 번 생성하고 주입한다.
Apps나 Controller 내부에서 구체 구현을 직접 생성하지 않는다.

### 5. 모든 진입점 등록

사용자가 실행할 수 있는 기능은 관련 진입점에 모두 연결한다.

#### Web UI

- 사용자 입력을 `AudioCommand`로 만든다.
- `useCommandExecutor` 또는 `executeWebAudioCommand`를 사용한다.
- Blob 다운로드처럼 Web 전용 후처리만 Web 계층에서 수행한다.

#### 내부 CLI

- [`src/layers/apps/cli/index.ts`](src/layers/apps/cli/index.ts)의 명령 목록에 이름, 설명, 사용법을 등록한다.
- CLI 인자를 검증한 뒤 `AudioCommand`를 만들어 `CommandExecutor`에 전달한다.
- Controller를 직접 호출하는 새 CLI 명령을 만들지 않는다.

#### Agent Chat

- [`getSystemPrompt.ts`](src/layers/apps/web/hooks/agent/useAgent/utils/getSystemPrompt.ts)의 Commands 목록에 등록한다.
- 필드 형식, 범위, 실행 순서 규칙을 추가한다.
- 한국어와 영어 사용자 요청 예시를 최소 1개씩 추가한다.
- Prompt가 생성하는 JSON이 `AudioCommandSchema`를 통과하는지 테스트한다.
- Agent 응답은 공통 `CommandExecutor`로 실행한다.

### 6. 테스트 작성

기능 구현 전에 실패하는 테스트를 먼저 작성한다.

- Schema 테스트: 정상값, 경계값, 잘못된 입력
- CommandExecutor 테스트: 올바른 Controller 호출과 실행 순서
- Controller 테스트: Session 변경, AudioEngine 호출, 에러 경로
- CLI 테스트: 명령어와 인자의 Command 변환
- Agent 테스트: Prompt 예시의 Schema 통과와 응답 파싱
- 통합 테스트: 사용자 입력부터 Session 또는 AudioEngine 결과까지

테스트 파일은 대상 파일 옆에 `*.test.ts`로 둔다. AudioEngine 같은 외부 의존성은 Mock 또는 Stub으로 격리한다.

## 기능 완료 체크리스트

- [ ] 아키텍처 문서를 확인했다.
- [ ] `AudioCommandType`과 Zod Schema를 추가했다.
- [ ] Controller에 동작을 구현했다.
- [ ] CommandExecutor에 실행 경로를 연결했다.
- [ ] 필요한 의존성을 `createApp`에서 주입했다.
- [ ] Web UI에 연결했다.
- [ ] 내부 CLI 명령과 도움말에 등록했다.
- [ ] Agent Chat Prompt의 명령·규칙·예시를 수정했다.
- [ ] Schema, Executor, Controller, CLI, Agent 테스트를 작성했다.
- [ ] 문서와 실제 구현이 일치한다.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build`가 성공한다.

## 코드 작성 규칙

- 파일은 kebab-case, 클래스는 PascalCase, 함수와 변수는 camelCase를 사용한다.
- 인터페이스는 프로젝트의 기존 규칙에 맞춰 `I` 접두사를 사용한다.
- 함수는 한 가지 역할만 맡고, 인자가 2개를 넘으면 객체로 묶는다.
- 중첩은 2단계 이하로 유지하고 early return을 사용한다.
- `any`, 매직넘버, dead code, 동작을 그대로 번역한 주석을 지양한다.
- 주석은 코드만으로 알기 어려운 이유와 제약을 설명할 때만 사용한다.
- 에러를 조용히 무시하지 않는다. Controller 또는 AudioEngine에서 의미 있는 에러를 만들고 Apps에서 사용자 메시지로 변환한다.

## 저장소 규칙

- 이 저장소는 monorepo가 아니다. `pnpm-workspace.yaml`을 추가하지 않는다.
- Node.js 22 이상과 pnpm 9 이상을 사용한다.
- 한 PR에는 한 가지 변경 목적만 포함한다. 목적이 다르면 stacked PR로 나눈다.
- 브랜치는 `feature/`, `bug/`, `hotfix/`, `refactor/` 중 하나로 시작한다.
- PR은 `origin/main`을 기준으로 만들고 테스트 방법을 본문에 적는다.
- 문서, 커밋 메시지, PR 본문과 코드 주석은 한글 UTF-8을 사용한다.
- 복잡하거나 혼동하기 쉬운 변경은 인라인 주석으로 이유를 설명한다.
- 생성 도구의 이름이나 자동 생성 서명 문구를 남기지 않는다.
