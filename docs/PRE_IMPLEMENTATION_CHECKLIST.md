# 구현 시작 전 사전 작업 체크리스트

Sprint 1 착수 전에 완료해야 할 정리/정비 작업 목록이다.
코드베이스를 깨끗하게 만들고, 레거시와 신규 레이어의 경계를 명확히 해서 이후 작업에서 혼란을 줄인다.

---

## 1. 레거시 코드 정리

### 1-1. 레거시 스토어 제거

현재 `src/stores/`에 4개의 Zustand 스토어가 있다. 전부 레거시 `/daw` 라우트 전용이며, `src/layers/`에서는 사용하지 않는다.

| 파일 | 용도 | 조치 |
|------|------|------|
| `src/stores/useTrackStore.ts` | 레거시 트랙 상태 (에이전트에서만 참조) | 삭제 |
| `src/stores/usePlaybackStore.ts` | 레거시 재생/줌/UI 상태 | 삭제 |
| `src/stores/useAudioFileStore.ts` | blob URL 오디오 캐시 | 삭제 |
| `src/stores/useAgentStore.ts` | LLM 로딩 상태 | 삭제 |

**확인 사항:** 삭제 전 `src/layers/` 내부에서 import하는 곳이 없는지 grep으로 재확인한다.

### 1-2. 레거시 core/infrastructure 제거

| 경로 | 내용 | 조치 |
|------|------|------|
| `src/core/` | `AudioService`(싱글턴), `Session`, `Track`, `Region`, export 파이프라인 | 삭제 |
| `src/infrastructure/` | README만 존재, 구현 코드 없음 | 삭제 |
| `src/presentation/` | `useAudioService.ts` (DAW 전용) | 삭제 |
| `src/logics/` | `useAudioCommand`, `regionRenderer`, `exportProject` 등 | 삭제 |

### 1-3. 레거시 컴포넌트 제거

`src/components/Daw/` 전체 (40+ 파일)를 삭제한다. `/daw` 라우트에서만 사용된다.

```
삭제 대상:
src/components/Daw/              # DawPage + 하위 전체
src/components/Drop/             # DropPage, DropPreviewModal
```

### 1-4. 레거시 훅/워커/타입 제거

| 경로 | 내용 | 조치 |
|------|------|------|
| `src/hooks/agent/` | WebLLM 에이전트 훅 7파일 | 삭제 |
| `src/workers/llm.worker.ts` | LLM 워커 | 삭제 |
| `src/types/audioTypes.ts` | 레거시 `TrackData` 등 | 삭제 |
| `src/types/audioFile.ts` | 레거시 오디오 파일 타입 | 삭제 |
| `src/types/audioCommand.schema.ts` | 레거시 에이전트 커맨드 스키마 | 삭제 |
| `src/types/agent.ts` | 에이전트 타입 | 삭제 |
| `src/types/webllm.types.ts` | WebLLM 타입 | 삭제 |
| `src/types/statusTypes.ts` | 상태 타입 | 삭제 |
| `src/types/track.ts` | 레거시 트랙 타입 | 삭제 |

### 1-5. 레거시 유틸 정리

`src/utils/`는 레이어에서도 일부 사용하므로 **선별 삭제**한다.

| 파일 | 사용처 | 조치 |
|------|--------|------|
| `wav-encoder.ts` | **layers** AudioEngine에서 사용 | **유지** |
| `visual-width.ts` | **layers** CLI에서 사용 | **유지** |
| `analytics.ts` | 에이전트 전용 | 삭제 |
| `hardwareInfo.ts` | 에이전트 전용 | 삭제 |
| `audio/formatDuration.ts` | 레거시 드롭 전용 | 삭제 |
| `audio/formatFileSize.ts` | 레거시 드롭 전용 | 삭제 |

---

## 2. App.tsx 정리 (이중 엔진 해소)

현재 `App.tsx`에 두 가지 문제가 있다:

### 문제 1: 레거시 초기화 코드

```typescript
// 현재 App.tsx - 삭제할 부분
import { AudioService } from '@/core/audio/AudioService';
import { Session as LegacySession } from '@/core/session/Session';

const legacySession = new LegacySession();
AudioService.initialize(legacySession);
```

`AudioService`와 `LegacySession`은 레거시 전용이므로 제거한다.

### 문제 2: LayerProvider 중복

- `App.tsx`에서 `LayerProvider` + `AudioEngine` 생성
- `WebDAW.tsx`에서 **또** `LayerProvider` + `AudioEngine` 생성
- `CliTestPage.tsx`에서 **또** `LayerProvider` + `AudioEngine` 생성
- 결과: Tone.js Transport가 여러 개 존재할 수 있는 충돌 위험

**해결:** `App.tsx`의 `LayerProvider`를 유일한 Provider로 사용하고, `WebDAW`와 `CliTestPage`에서 중복 생성을 제거한다.

### 정리 후 App.tsx 구조

```typescript
import { AudioEngine } from './layers/audio-engine/audio-engine';
import { LayerProvider } from './layers/apps/context/LayerContext';

function App() {
  const audioEngine = useMemo(() => new AudioEngine(), []);

  return (
    <LayerProvider engine={audioEngine}>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </LayerProvider>
  );
}
```

---

## 3. 라우터 정리

### 현재 라우트

```
/          → DropPage (레거시 파일 드롭)
/daw       → DawPage (레거시 DAW UI)
/cli-test  → CliTestPage (레이어 CLI)
/web-daw   → WebDAW (레이어 웹 앱)
```

### 정리 후 라우트

```
/          → CliTestPage (CLI 기본 진입점)
/web-daw   → WebDAW (나중에 UI 작업 시)
```

`/daw`와 `/` (DropPage)는 레거시이므로 제거한다.

---

## 4. 레거시 공용 컴포넌트 판단

`src/components/common/`에 있는 파일들의 처리:

| 파일 | 사용처 | 조치 |
|------|--------|------|
| `FileDrop/AudioFileDrop.tsx` | 레거시 DropPage | 삭제 |
| `FileDrop/BasicFileDrop.tsx` | 레거시 DropPage | 삭제 |
| `FileDrop/FileDrop.css.ts` | 레거시 DropPage | 삭제 |
| `FileDrop/constants/audioConstants.ts` | 레거시 DropPage | 삭제 |
| `ErrorBoundary/GlobalErrorFallback.tsx` | 앱 전역 | **유지** |
| `ErrorBoundary/GlobalErrorFallback.css.ts` | 앱 전역 | **유지** |
| `DebouncedInput.tsx` | layers WebDAW transport | **유지** |
| `AnalyticsTracker.tsx` | 앱 전역 | 판단 필요 (GA4 유지 여부) |
| `Layouts/DefaultLayout.tsx` | 앱 전역 | **유지** (필요 시 리팩토링) |

---

## 5. 미사용 npm 패키지 정리

`package.json`에서 레거시 전용으로 보이는 의존성:

### 삭제 후보 (dependencies)

| 패키지 | 근거 |
|--------|------|
| `@mlc-ai/web-llm` | 에이전트 전용 (레거시 삭제 시 불필요) |
| `@wavesurfer/react` | 레거시 DAW RegionComponent 전용 |
| `wavesurfer.js` | 위와 동일 |
| `react-ga4` | AnalyticsTracker (유지 여부 판단) |
| `@radix-ui/*` (전부) | 현재 코드에서 import 없음 |
| `es-toolkit` | 현재 코드에서 import 없음 |
| `@tanstack/react-query` | 레거시 전용으로 추정 |

### 삭제 후보 (devDependencies)

| 패키지 | 근거 |
|--------|------|
| `vite-plugin-checker` | vite.config.ts에 미등록 (미사용) |

### 유지 (확실)

| 패키지 | 근거 |
|--------|------|
| `react`, `react-dom` | 필수 |
| `react-router-dom` | 라우팅 |
| `tone` | AudioEngine |
| `zustand` | Session |
| `zod` | 향후 커맨드 스키마 검증 |
| `xterm`, `xterm-addon-fit` | CLI 터미널 |
| `react-dropzone` | 파일 업로드 (layers CLI에서도 사용 가능) |
| `react-error-boundary` | 에러 바운더리 |
| `react-simplikit` | 유지 |
| `@vanilla-extract/*` | 스타일링 |
| `vitest`, `@playwright/test` | 테스트 |

---

## 6. records/ 디렉토리 판단

`src/layers/discipline.md`에 명시되어 있음:

> `records/` 디렉터리의 문서들은 마이그레이션 이전 구현 기록이다. 현재 아키텍처 가이드로 참고하지 않는다.

**조치:** 삭제한다. 필요한 히스토리는 git에 남아 있다.

---

## 7. ESLint / 설정 정비

### 7-1. 미사용 ESLint 플러그인 정리

`package.json`에는 있으나 `eslint.config.js`에서 사용하지 않는 플러그인:
- `eslint-plugin-jsx-a11y` — config에 미등록
- `eslint-plugin-react-hooks` — config에 미등록 (확인 필요)

**조치:** 사용하지 않는 플러그인은 devDependencies에서 제거하거나, config에 등록한다.

### 7-2. vitest.config.ts 범위 확인

현재 `include: ['src/layers/**/*.test.{ts,tsx}']`로 설정되어 있다.
레거시 코드 삭제 후에도 이 범위가 맞는지 확인한다.

---

## 8. 실행 순서

위 작업을 아래 순서로 진행한다:

### Step 1: 레거시 코드 삭제 (한 번에)

```
삭제:
  src/stores/
  src/core/
  src/infrastructure/
  src/presentation/
  src/logics/
  src/hooks/agent/
  src/workers/
  src/types/
  src/components/Daw/
  src/components/Drop/
  src/components/common/FileDrop/
  src/utils/analytics.ts
  src/utils/hardwareInfo.ts
  src/utils/audio/
  records/
```

### Step 2: App.tsx 리팩토링

- 레거시 import 제거
- LayerProvider 중복 해소

### Step 3: 라우터 정리

- `/daw`, `/` (DropPage) 라우트 제거
- `/` → CliTestPage로 변경

### Step 4: WebDAW / CliTestPage 중복 Provider 제거

- 상위 App.tsx의 LayerProvider를 사용하도록 변경

### Step 5: npm 패키지 정리

```bash
pnpm remove @mlc-ai/web-llm @wavesurfer/react wavesurfer.js @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-tooltip es-toolkit @tanstack/react-query react-ga4 vite-plugin-checker
```

### Step 6: 빌드 + 타입체크 + 린트 확인

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test:unit
```

깨지는 import가 있으면 수정한다.

### Step 7: discipline.md에 정리 결과 반영

삭제한 내용과 남은 구조를 discipline.md에 업데이트한다.

---

## 정리 후 예상 디렉토리 구조

```
src/
├── layers/                          # 핵심 (유지)
│   ├── audio-engine/
│   ├── session/
│   ├── controllers/
│   ├── apps/
│   │   ├── create-app.ts
│   │   ├── context/LayerContext.tsx
│   │   ├── cli/
│   │   └── web/
│   ├── integration.test.ts
│   └── discipline.md
│
├── components/                      # 공용만 남김
│   ├── common/
│   │   ├── ErrorBoundary/
│   │   ├── DebouncedInput.tsx
│   │   └── AnalyticsTracker.tsx     # (유지 여부 판단)
│   └── Layouts/
│       └── DefaultLayout.tsx
│
├── utils/                           # 레이어에서 사용하는 것만
│   ├── wav-encoder.ts
│   └── visual-width.ts
│
├── styles/
│   └── global.css.ts
│
├── router/
│   └── AppRouter.tsx
│
├── App.tsx
├── main.tsx
└── vite-env.d.ts
```
