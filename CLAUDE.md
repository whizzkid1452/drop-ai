# CLAUDE.md

## Commands

- `pnpm test` - 테스트 실행
- `pnpm test:watch` - 워치 모드 테스트
- `pnpm lint` - eslint 실행
- `pnpm typecheck` - 타입 체크
- `pnpm build` - 빌드

## Git Worktree

- 이 프로젝트는 monorepo가 아니므로 `pnpm-workspace.yaml`을 사용하지 않는다 (`.npmrc`로 대체)
- `pnpm worktree:add <branch>` — 외부 worktree 생성 (`../drop-ai--<branch>`)
- `pnpm worktree:add:internal <branch>` — 내부 worktree 생성 (`worktrees/<branch>`)
- `pnpm worktree:remove <branch>` — 외부 worktree 제거
- `pnpm worktree:remove:internal <branch>` — 내부 worktree 제거
- `pnpm worktree:list` — 현재 worktree 목록 확인
- `pnpm-workspace.yaml`을 다시 추가하면 내부 worktree에서 상위를 workspace root로 인식하는 문제가 발생하므로 추가하지 않는다

## Code Style

- `tsconfig.app.json`의 컴파일러 옵션을 따른다
- 파일 작성/수정 후 `pnpm typecheck`와 `pnpm lint`로 타입 및 포맷 확인
- 작업 완료 전 반드시 `pnpm lint`와 `npx prettier --write .`를 실행하여 포맷 및 린트 에러를 해결한다.

## Architecture

- 레이어 의존성 규칙은 `src/layers/discipline.md`를 따른다
- 의존성 방향: Apps → Controllers → Session / AudioEngine
- 구체 구현이 아닌 인터페이스(IAudioEngine 등)에 의존한다
- 객체 생성과 조립은 Factory(Composition Root)에서만 한다

## Conventions

### Naming

- 파일: kebab-case (`playback-controller.ts`)
- 클래스: PascalCase (`PlaybackController`)
- 함수/변수: camelCase (`handlePlay`)
- 인터페이스: `I` 접두사 (`IAudioEngine`)

### Functions

- 한 함수는 한 가지 일만 한다
- 함수 인자는 2개 이하로 유지, 초과 시 객체로 묶는다
- 사이드이펙트가 있는 함수와 없는 함수를 분리한다

### General

- 매직넘버 대신 이름이 있는 상수를 사용한다
- 중첩(if/for)은 2단계 이하로 유지, early return을 활용한다
- 주석 대신 코드 자체가 의도를 드러내도록 작성한다
- 불필요한 주석, dead code는 남기지 않는다
- `any` 사용을 지양한다

## TDD

- 기능 구현 전에 테스트를 먼저 작성한다 (Red → Green → Refactor)
- 테스트 파일은 대상 파일 옆에 `*.test.ts`로 배치한다
- 하나의 테스트는 하나의 동작만 검증한다
- 구현 코드를 수정하면 반드시 `pnpm test`로 기존 테스트가 깨지지 않는지 확인한다
- 외부 의존성(AudioEngine 등)은 Mock/Stub으로 대체하여 단위 테스트를 격리한다
- 커버리지보다 의미 있는 테스트를 우선한다 — 핵심 로직, 경계값, 에러 케이스에 집중
