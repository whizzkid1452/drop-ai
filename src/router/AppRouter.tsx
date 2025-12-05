import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { DefaultLayout } from '@/components/Layouts/DefaultLayout';
import { HomePage } from '@/components/Home/HomePage';
import { DropZonePage } from '@/components/DropZone/DropZonePage';

// DAW 페이지만 lazy load (wavesurfer.js 등 무거운 의존성 포함)
const DawPage = lazy(() => import('@/components/Daw/DawPage'));

// Loading fallback 컴포넌트
const LoadingFallback = () => (
  <DefaultLayout>
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '50vh',
        fontSize: '1.2rem',
        color: '#666',
      }}
    >
      Loading...
    </div>
  </DefaultLayout>
);

// View 컴포넌트들
const HomeView = () => (
  <DefaultLayout>
    <HomePage />
  </DefaultLayout>
);

const DropZoneView = () => (
  <DefaultLayout>
    <DropZonePage />
  </DefaultLayout>
);

const DawView = () => (
  <DefaultLayout>
    <Suspense fallback={<LoadingFallback />}>
      <DawPage />
    </Suspense>
  </DefaultLayout>
);

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomeView />} />
      <Route path="/daw" element={<DawView />} />
      <Route path="/dropzone" element={<DropZoneView />} />
    </Routes>
  );
}

