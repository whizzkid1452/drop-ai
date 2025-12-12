import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Lazy load components
const HomeView = lazy(() => import('@/views/Home/HomeView'));
const DawView = lazy(() => import('@/views/Daw/DawView'));

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
        <Route path="/dropzone" element={<Navigate to="/daw" replace />} />
      </Routes>
    </Suspense>
  );
}

