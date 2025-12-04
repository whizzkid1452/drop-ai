# Lazy Loading 적용 작업 기록

## 작업 개요

React의 `lazy()`와 `Suspense`를 사용하여 라우트 기반 코드 스플리팅 및 레이지 로딩을 적용했습니다.

## 주요 변경사항

### 1. 뷰 컴포넌트에 default export 추가

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

### 2. AppRouter에 Lazy Loading 적용

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
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
    }}
  >
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

## 적용 효과

### 1. 코드 스플리팅

- 각 라우트가 별도의 JavaScript 청크로 분리됨
- 빌드 시 각 뷰 컴포넌트가 독립적인 번들 파일로 생성됨

### 2. 초기 로딩 시간 단축

- 앱 시작 시 모든 페이지를 로드하지 않고, 필요한 페이지만 동적으로 로드
- 초기 번들 크기 감소로 First Contentful Paint (FCP) 개선

### 3. 번들 크기 최적화

- 사용하지 않는 페이지는 로드하지 않음
- 네트워크 대역폭 절약

### 4. 사용자 경험 개선

- 페이지 전환 시 로딩 상태 표시 (`LoadingFallback` 컴포넌트)
- 더 빠른 초기 로딩으로 사용자 이탈률 감소

## 기술적 세부사항

### React.lazy()

- 컴포넌트를 동적으로 import하는 함수
- React 16.6부터 지원
- default export만 지원 (named export는 지원하지 않음)

### Suspense

- 비동기 컴포넌트 로딩 중 fallback UI를 표시하는 React 컴포넌트
- React 16.6부터 지원
- lazy 컴포넌트를 감싸야 함

### Dynamic Import

- ES2020의 동적 import 문법을 활용한 코드 스플리팅
- 빌드 도구(Vite)가 자동으로 코드 스플리팅 처리

## 주의사항

1. **Default Export 필수**
   - `React.lazy()`는 default export만 지원
   - 각 뷰 컴포넌트에 default export 추가 필요
   - 기존 named export는 유지하여 하위 호환성 보장

2. **Suspense 위치**
   - lazy 컴포넌트를 감싸야 함
   - 최상위 라우터 레벨에 배치 권장

3. **Fallback UI**
   - 로딩 중 사용자에게 피드백 제공 필요
   - 현재는 간단한 텍스트로 구현, 향후 개선 가능

## 향후 개선 가능 사항

- [ ] 로딩 스피너 또는 스켈레톤 UI로 `LoadingFallback` 개선
- [ ] 에러 바운더리 추가 (로딩 실패 시 처리)
- [ ] 프리로딩 전략 적용 (마우스 호버 시 미리 로드)
- [ ] 로딩 상태에 따른 애니메이션 추가
- [ ] 각 라우트별 커스텀 로딩 컴포넌트 지원

## 관련 파일

- `src/router/AppRouter.tsx` - 라우터 설정 및 lazy loading 적용
- `src/views/Home/HomeView.tsx` - 홈 뷰 컴포넌트
- `src/views/Daw/DawView.tsx` - DAW 뷰 컴포넌트
- `src/views/DropZone/DropZoneView.tsx` - 드롭존 뷰 컴포넌트

## 참고 자료

- [React 공식 문서 - Code Splitting](https://react.dev/reference/react/lazy)
- [React Router - Code Splitting](https://reactrouter.com/en/main/route/lazy)
