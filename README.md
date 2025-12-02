# Drop.ai Web DAW

**Ardour 스타일의 전문가용 웹 기반 DAW**

현대적인 React 개발 환경으로 구축된 브라우저 기반 디지털 오디오 워크스테이션입니다.

## 🚀 기술 스택

### Frontend

- **React 19** - 최신 React 버전
- **Vite** - 빠른 빌드 도구
- **TypeScript** - 타입 안전성
- **Vanilla Extract** - CSS-in-JS 스타일링
- **Radix UI** - 접근성이 뛰어난 UI 컴포넌트
- **pnpm** - 빠르고 효율적인 패키지 매니저

### Audio Engine

- **Web Audio API** - 네이티브 오디오 처리
- **WaveSurfer.js** - 파형 시각화
- **AudioWorklet** - 메트로놈 (실시간 클릭)
- **Tone.js** (검토 중) - 오디오 스케줄링

### DevOps

- **Docker** - 컨테이너화 및 배포
- **Nginx** - 프로덕션 서버

## 📦 설치된 패키지

### 핵심 의존성

- `react` - React 라이브러리
- `react-dom` - React DOM 렌더링

### Radix UI 컴포넌트

- `@radix-ui/react-dialog` - 모달 다이얼로그
- `@radix-ui/react-dropdown-menu` - 드롭다운 메뉴
- `@radix-ui/react-select` - 선택 컴포넌트
- `@radix-ui/react-tabs` - 탭 컴포넌트
- `@radix-ui/react-toast` - 토스트 알림
- `@radix-ui/react-tooltip` - 툴팁

### 개발 도구

- `@vanilla-extract/css` - CSS-in-JS 스타일링
- `@vanilla-extract/vite-plugin` - Vite 플러그인
- `typescript` - TypeScript 컴파일러
- `vite` - 빌드 도구
- `eslint` - 코드 품질 검사

## 🛠️ 개발 환경 설정

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 개발 서버 실행

```bash
pnpm dev
```

### 3. 프로덕션 빌드

```bash
pnpm build
```

### 4. 빌드 결과 미리보기

```bash
pnpm preview
```

### 5. 코드 품질 검사

```bash
pnpm lint
```

## 🚀 Vercel 배포 (권장)

이 프로젝트는 **Vercel**을 통해 무료로 배포할 수 있습니다. **Private GitHub 리포지토리에서도 추가 비용 없이 배포 가능**합니다.

### Vercel 배포 장점

- ✅ **무료**: Private 리포지토리도 무료로 배포 가능
- ✅ **자동 HTTPS**: SSL 인증서 자동 설정
- ✅ **자동 배포**: GitHub 푸시 시 자동 배포
- ✅ **빠른 CDN**: 전 세계 CDN으로 빠른 로딩
- ✅ **프리뷰 배포**: Pull Request마다 프리뷰 URL 생성

### 배포 방법

#### 방법 1: Vercel 웹 대시보드 (가장 간단)

1. **Vercel 계정 생성**
   - https://vercel.com 에서 GitHub 계정으로 로그인

2. **프로젝트 가져오기**
   - "Add New Project" 클릭
   - GitHub 리포지토리 `HURRAEY/daw` 선택
   - Vercel이 자동으로 설정을 감지합니다

3. **배포 설정 확인**
   - Framework Preset: `Vite`
   - Build Command: `pnpm build` (자동 감지)
   - Output Directory: `dist` (자동 감지)
   - Install Command: `pnpm install` (자동 감지)

4. **배포 시작**
   - "Deploy" 버튼 클릭
   - 몇 분 후 배포 완료!

#### 방법 2: Vercel CLI

```bash
# Vercel CLI 설치
pnpm add -D vercel

# 배포
npx vercel

# 프로덕션 배포
npx vercel --prod
```

### 배포 후

- 배포가 완료되면 `https://daw-*.vercel.app` 형태의 URL이 생성됩니다
- 커스텀 도메인도 무료로 추가 가능합니다
- `main` 브랜치에 푸시할 때마다 자동으로 재배포됩니다

### 환경 변수 설정

필요한 경우 Vercel 대시보드에서 환경 변수를 설정할 수 있습니다:

- Settings > Environment Variables

### 로컬에서 빌드 테스트

```bash
# 프로덕션 빌드
pnpm build

# 빌드 결과 미리보기
pnpm preview
```

## 🐳 Docker 사용법

### 도커 이미지 빌드

#### 프로덕션 빌드

```bash
# 프로덕션 이미지 빌드
pnpm docker:build

# 또는 직접 도커 명령어 사용
docker build -t daw-app .
```

#### 개발 환경 빌드

```bash
# 개발 환경 이미지 빌드
pnpm docker:build:dev

# 또는 직접 도커 명령어 사용
docker build -f Dockerfile.dev -t daw-app:dev .
```

### 도커 컨테이너 실행

#### 프로덕션 환경

```bash
# 프로덕션 컨테이너 실행 (포트 80)
pnpm docker:run

# 또는 직접 도커 명령어 사용
docker run -p 80:80 daw-app
```

#### 개발 환경

```bash
# 개발 환경 컨테이너 실행 (포트 5173)
pnpm docker:run:dev

# 또는 직접 도커 명령어 사용
docker run -p 5173:5173 -v $(pwd):/app daw-app:dev
```

### Docker Compose 사용

#### 개발 환경 실행

```bash
# 개발 환경만 실행
pnpm docker:compose:dev

# 또는 직접 docker-compose 명령어 사용
docker-compose up app-dev
```

#### 프로덕션 환경 실행

```bash
# 프로덕션 환경 실행
pnpm docker:compose:prod

# 또는 직접 docker-compose 명령어 사용
docker-compose up app-prod
```

#### 전체 서비스 관리

```bash
# 모든 서비스 빌드
pnpm docker:compose:build

# 모든 서비스 중지 및 제거
pnpm docker:compose:down

# 또는 직접 docker-compose 명령어 사용
docker-compose build
docker-compose down
```

### 도커 접속 정보

- **개발 환경**: http://localhost:5173
- **프로덕션 환경**: http://localhost:80
- **개발용 nginx**: http://localhost:8080

## 🎨 스타일링 시스템

### Vanilla Extract

- **타입 안전한 CSS**: TypeScript와 완벽하게 통합
- **CSS 변수**: 동적 테마 및 색상 관리
- **스프라이트**: CSS 번들 최적화
- **전역 스타일**: 일관된 디자인 시스템

### 컴포넌트 스타일

- `button` - 기본 버튼 스타일
- `buttonPrimary` - 주요 액션 버튼
- `buttonSecondary` - 보조 액션 버튼
- `input` - 입력 필드 스타일
- `card` - 카드 컨테이너
- `container` - 레이아웃 컨테이너

## 🧩 Radix UI 컴포넌트

### 사용 가능한 컴포넌트

1. **Dialog** - 모달 다이얼로그
2. **Tabs** - 탭 인터페이스
3. **Toast** - 토스트 알림
4. **Tooltip** - 툴팁
5. **Select** - 선택 드롭다운
6. **Dropdown Menu** - 드롭다운 메뉴

### 특징

- **접근성**: WCAG 가이드라인 준수
- **키보드 네비게이션**: 완벽한 키보드 지원
- **스크린 리더**: 스크린 리더 최적화
- **테마 지원**: 다크/라이트 모드 지원 가능

## 📁 프로젝트 구조

```
daw/
├── src/
│   ├── styles/
│   │   ├── global.css.ts      # 전역 스타일
│   │   └── components.css.ts  # 컴포넌트 스타일
│   ├── App.tsx                # 메인 앱 컴포넌트
│   ├── main.tsx              # 앱 진입점
│   └── vite-env.d.ts         # Vite 타입 정의
├── Dockerfile                 # 프로덕션 도커 설정
├── Dockerfile.dev            # 개발 환경 도커 설정
├── docker-compose.yml        # 도커 컴포즈 설정
├── nginx.conf                # nginx 설정
├── .dockerignore             # 도커 빌드 제외 파일
├── vite.config.ts            # Vite 설정
├── tsconfig.json             # TypeScript 설정
├── package.json              # 프로젝트 의존성
└── README.md                 # 프로젝트 문서
```

## 🔧 설정 파일

### Vite 설정 (`vite.config.ts`)

- React 플러그인
- Vanilla Extract 플러그인
- 빠른 HMR (Hot Module Replacement)

### TypeScript 설정 (`tsconfig.json`)

- 엄격한 타입 검사
- 최신 ES2022 기능 지원
- React JSX 변환

### Docker 설정

- **Dockerfile**: 멀티스테이지 빌드로 최적화된 프로덕션 이미지
- **Dockerfile.dev**: 개발 환경을 위한 이미지
- **docker-compose.yml**: 개발/프로덕션 환경 통합 관리
- **nginx.conf**: SPA 최적화 및 보안 설정

## 🚀 개발 팁

### 1. 새로운 컴포넌트 스타일 추가

```typescript
// src/styles/components.css.ts
export const newComponent = style({
  // CSS 속성들
});
```

### 2. Radix UI 컴포넌트 커스터마이징

```typescript
import * as Dialog from '@radix-ui/react-dialog';

<Dialog.Root>
  <Dialog.Trigger>열기</Dialog.Trigger>
  <Dialog.Content>
    {/* 커스텀 스타일 적용 */}
  </Dialog.Content>
</Dialog.Root>
```

### 3. 전역 스타일 추가

```typescript
// src/styles/global.css.ts
globalStyle('body', {
  backgroundColor: '#f5f5f5',
});
```

### 4. 도커 개발 환경에서 HMR 사용

```bash
# 볼륨 마운트로 소스 코드 변경사항 실시간 반영
docker run -p 5173:5173 -v $(pwd):/app daw-app:dev
```

## 📚 추가 리소스

- [React 공식 문서](https://react.dev/)
- [Vite 공식 문서](https://vitejs.dev/)
- [Vanilla Extract 문서](https://vanilla-extract.style/)
- [Radix UI 문서](https://www.radix-ui.com/)
- [TypeScript 공식 문서](https://www.typescriptlang.org/)
- [Docker 공식 문서](https://docs.docker.com/)
- [Docker Compose 문서](https://docs.docker.com/compose/)

## 🤝 기여하기

1. 이슈 생성 또는 기존 이슈 확인
2. 기능 브랜치 생성
3. 코드 작성 및 테스트
4. Pull Request 생성

## �� 라이선스

MIT License

---

## Drop.ai Guide

진행 중인 기능과 AI 통합 가이드는 `readme_Drop.ai_guide` 파일에 정리합니다.
