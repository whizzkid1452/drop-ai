# React Router 설정 작업 기록

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

| 경로        | 컴포넌트       | 설명                                   |
| ----------- | -------------- | -------------------------------------- |
| `/`         | `HomeView`     | 홈 페이지                              |
| `/daw`      | `DawView`      | DAW (Digital Audio Workstation) 페이지 |
| `/dropzone` | `DropZoneView` | 파일 드롭존 페이지                     |

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
- [x] 레이지 로딩 (Lazy Loading) 적용 ✅ (자세한 내용은 `lazy-loading-setup.md` 참고)
- [ ] 404 페이지 추가
- [x] 라우트 기반 코드 스플리팅 ✅ (자세한 내용은 `lazy-loading-setup.md` 참고)
