# DAW Engine 원본 정보

## 목적

drop-ai에서 DAW Engine 소스를 직접 import하고, 애플리케이션과 엔진 변경을 같은 저장소에서 관리한다.

## 원본

- 저장소: https://github.com/HURRAEY/daw-engine
- 기준 브랜치: `main`
- 기준 커밋: `002e880cb5c1e1fc7609264d5d6ec44c36e0ed29`
- 가져온 날짜: 2026-08-10

`core/LICENSE`와 `ui-utils/LICENSE`의 MIT 라이선스 고지를 유지한다.

## 통합 경계

- drop-ai는 `core/src/browser-adapter.ts`를 통해서만 엔진 소스를 사용한다.
- drop-ai의 `DawEngineAdapter`가 애플리케이션 계약과 엔진 계약을 변환한다.
- Vite와 Vitest는 `core/src/browser-adapter.ts`를 직접 사용하고, drop-ai TypeScript 검사는 엔진의 독립 컴파일러 설정을 보존하기 위해 `package-dist/browser-adapter.d.ts`를 사용한다.
- `package-dist`는 Git dependency 배포 호환성을 위한 생성 결과물이며 drop-ai 빌드의 import 대상이 아니다.

## npm 패키지 검증

`@daw-engine/core` 패키지는 다음 명령으로 배포 파일을 검증한다.

```bash
cd daw-engine
pnpm install --frozen-lockfile
cd core
npm pack --dry-run
```

실제 배포 전에는 `core/package.json`의 버전을 올리고 npm scope 권한을 확인한다.

로그인과 scope 권한을 확인한 뒤 `daw-engine` 디렉터리에서 다음 명령으로 core 패키지를 배포한다.

```bash
pnpm publish:core
```
