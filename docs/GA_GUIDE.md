# Google Analytics 4 (GA4) 연동 및 사용 가이드

이 프로젝트는 `react-ga4` 라이브러리를 사용하여 구글 애널리틱스 4와 연동되어 있습니다. 단순히 스크립트를 삽입하는 방식이 아니라, 리액트 환경 및 SPA(Single Page Application)의 특성에 최적화된 구조로 설계되었습니다.

## 1. 주요 연동 아키텍처

### 1) 환경 변수 기반 초기화

- **파일**: `src/main.tsx`, `.env.production`
- **로직**: `import.meta.env.PROD`가 true이고(배포 환경), `VITE_GA_ID`가 설정된 경우에만 GA가 초기화됩니다. 개발 환경에서의 데이터 오염을 방지합니다.

### 2) SPA 자동 페이지 추적

- **파일**: `src/components/common/AnalyticsTracker.tsx`
- **로직**: `react-router-dom`의 `useLocation` 훅을 사용하여 URL 경로가 바뀔 때마다 자동으로 `pageview` 이벤트를 GA로 전송합니다. `App.tsx`의 라우터 내부에 배치되어 전역적으로 작동합니다.

## 2. 기본 사용법 및 이벤트 추적

### 1) 커스텀 이벤트 전송

사용자의 특정 행동(버튼 클릭, 기능 사용 등)을 추적할 때 사용합니다.

```tsx
import ReactGA from 'react-ga4';

const MyComponent = () => {
  const handleAction = () => {
    // 이벤트 전송
    ReactGA.event({
      category: 'User Interaction', // 큰 범주
      action: 'Click Export Button', // 구체적 행동
      label: 'Main Page', // (선택) 추가 정보
    });

    // 로직 수행...
  };

  return <button onClick={handleAction}>추적 버튼</button>;
};
```

### 2) 사용자 ID 설정 (로그인 기능 사용 시)

로그인한 사용자의 데이터를 통합하여 분석하고 싶을 때 사용합니다.

```tsx
ReactGA.set({ userId: 'user_12345' });
```

## 3. 리팩토링 및 에러 수정 내역 (Build Fix)

이번 작업 중 빌드 안정성을 위해 다음 사항들을 함께 수정했습니다:

- **데이터 형식 안정화**: `useAgent.ts`에서 AI 응답 데이터(`parsedCommands`)가 비어있을 경우 발생하던 타입 오류를 수정했습니다.
- **코드 최적화**: `audioCommand.schema.ts`에서 사용되지 않는 변수를 제거하여 빌드 경고를 해결했습니다.
- **의존성 통합**: `react-ga4` 패키지를 `package.json`에 공식 등록하여 모든 환경에서 동일하게 동작하도록 했습니다.

## 4. 데이터 확인 방법

1. [Google Analytics 실시간 보고서](https://analytics.google.com/)에 접속합니다.
2. 배포된 사이트에서 페이지를 이동하거나 이벤트를 발생시킵니다.
3. 약 10~30초 이내에 실시간 대시보드에 데이터가 표시되는지 확인합니다.
