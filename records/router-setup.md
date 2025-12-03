# React Router 설정 작업 기록

## 작업 일시
2024년 (최근 작업)

## 작업 개요
React Router를 사용하여 애플리케이션의 라우팅 시스템을 설정했습니다.

## 주요 작업 내용

### 1. 의존성 설치
- `react-router-dom` v7.10.0 설치 완료

### 2. 라우터 구조 설정

#### 파일 구조
```
src/
├── router/
│   └── AppRouter.tsx      # 라우터 설정 컴포넌트
├── views/
│   ├── Home/
│   │   └── HomeView.tsx    # 홈 페이지 뷰
│   ├── Daw/
│   │   └── DawView.tsx     # DAW 페이지 뷰
│   └── DropZone/
│       └── DropZoneView.tsx # 드롭존 페이지 뷰
└── App.tsx                 # 메인 앱 컴포넌트
```

#### 라우터 구현 방식
- `Routes`와 `Route` 컴포넌트를 사용한 선언적 라우팅 방식 채택
- `BrowserRouter`를 `App.tsx`에서 최상위에 설정

### 3. 라우트 경로 설정

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | `HomeView` | 홈 페이지 |
| `/daw` | `DawView` | DAW (Digital Audio Workstation) 페이지 |
| `/dropzone` | `DropZoneView` | 파일 드롭존 페이지 |

### 4. 주요 파일 내용

#### `src/router/AppRouter.tsx`
```tsx
import { Routes, Route } from 'react-router-dom';
import { HomeView } from '@/views/Home/HomeView';
import { DawView } from '@/views/Daw/DawView';
import { DropZoneView } from '@/views/DropZone/DropZoneView';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomeView />} />
      <Route path="/daw" element={<DawView />} />
      <Route path="/dropzone" element={<DropZoneView />} />
    </Routes>
  );
}
```

#### `src/App.tsx`
```tsx
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router/AppRouter';

function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

export default App;
```

### 5. View 컴포넌트 구조
각 View 컴포넌트는 `DefaultLayout`으로 감싸져 있으며, 해당하는 Page 컴포넌트를 렌더링합니다:

- `HomeView` → `HomePage`
- `DawView` → `DawPage`
- `DropZoneView` → `DropZonePage`

### 6. 기술 스택
- **React Router DOM**: v7.10.0
- **React**: v18.3.1
- **TypeScript**: ~5.8.3

## 설계 결정 사항

### 선언적 라우팅 방식 선택
- `createBrowserRouter` + `RouterProvider` 방식 대신
- `BrowserRouter` + `Routes`/`Route` 컴포넌트 방식 채택
- 이유: 더 선언적이고 React 컴포넌트 패턴에 부합

### 파일 네이밍
- 라우터 파일: `AppRouter.tsx` (컴포넌트 이름과 일치)
- View 파일: `*View.tsx` (페이지 레벨 컴포넌트)
- Page 파일: `*Page.tsx` (실제 페이지 컨텐츠)

## 향후 개선 사항
- [ ] 라우트 보호 (Protected Routes) 추가
- [x] 레이지 로딩 (Lazy Loading) 적용 ✅
- [ ] 404 페이지 추가
- [x] 라우트 기반 코드 스플리팅 ✅

---

## Lazy Loading 적용 (2024년 최근)

### 작업 개요
React의 `lazy()`와 `Suspense`를 사용하여 라우트 기반 코드 스플리팅 및 레이지 로딩을 적용했습니다.

### 주요 변경사항

#### 1. 뷰 컴포넌트에 default export 추가
각 뷰 컴포넌트에 default export를 추가하여 `React.lazy()`와 호환되도록 수정했습니다.

**변경된 파일:**
- `src/views/Home/HomeView.tsx`
- `src/views/Daw/DawView.tsx`
- `src/views/DropZone/DropZoneView.tsx`

**변경 내용:**
```tsx
// 기존: named export만 존재
export const HomeView = () => { ... };

// 추가: default export 추가 (named export 유지)
export default HomeView;
```

#### 2. AppRouter에 Lazy Loading 적용

**변경 전:**
```tsx
import { Routes, Route } from 'react-router-dom';
import { HomeView } from '@/views/Home/HomeView';
import { DawView } from '@/views/Daw/DawView';
import { DropZoneView } from '@/views/DropZone/DropZoneView';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomeView />} />
      <Route path="/daw" element={<DawView />} />
      <Route path="/dropzone" element={<DropZoneView />} />
    </Routes>
  );
}
```

**변경 후:**
```tsx
import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

// Lazy load components
const HomeView = lazy(() => import('@/views/Home/HomeView'));
const DawView = lazy(() => import('@/views/Daw/DawView'));
const DropZoneView = lazy(() => import('@/views/DropZone/DropZoneView'));

// Loading fallback component
const LoadingFallback = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    minHeight: '100vh' 
  }}>
    <div>Loading...</div>
  </div>
);

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/daw" element={<DawView />} />
        <Route path="/dropzone" element={<DropZoneView />} />
      </Routes>
    </Suspense>
  );
}
```

### 적용 효과

1. **코드 스플리팅**
   - 각 라우트가 별도의 JavaScript 청크로 분리됨
   - 빌드 시 각 뷰 컴포넌트가 독립적인 번들 파일로 생성됨

2. **초기 로딩 시간 단축**
   - 앱 시작 시 모든 페이지를 로드하지 않고, 필요한 페이지만 동적으로 로드
   - 초기 번들 크기 감소로 First Contentful Paint (FCP) 개선

3. **번들 크기 최적화**
   - 사용하지 않는 페이지는 로드하지 않음
   - 네트워크 대역폭 절약

4. **사용자 경험 개선**
   - 페이지 전환 시 로딩 상태 표시 (`LoadingFallback` 컴포넌트)
   - 더 빠른 초기 로딩으로 사용자 이탈률 감소

### 기술적 세부사항

- **React.lazy()**: 컴포넌트를 동적으로 import하는 함수
- **Suspense**: 비동기 컴포넌트 로딩 중 fallback UI를 표시하는 React 컴포넌트
- **Dynamic Import**: ES2020의 동적 import 문법을 활용한 코드 스플리팅

### 주의사항

- `React.lazy()`는 default export만 지원하므로, 각 뷰 컴포넌트에 default export 추가 필요
- 기존 named export는 유지하여 하위 호환성 보장
- `Suspense`는 lazy 컴포넌트를 감싸야 하며, 최상위 라우터 레벨에 배치

### 향후 개선 가능 사항

- [ ] 로딩 스피너 또는 스켈레톤 UI로 `LoadingFallback` 개선
- [ ] 에러 바운더리 추가 (로딩 실패 시 처리)
- [ ] 프리로딩 전략 적용 (마우스 호버 시 미리 로드)

