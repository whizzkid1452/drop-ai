import { Routes, Route } from 'react-router-dom';
import { DefaultLayout } from '@/components/Layouts/DefaultLayout';
import { HomePage } from '@/components/Home/HomePage';
import { DropZonePage } from '@/components/DropZone/DropZonePage';
import { DawPage } from '@/components/Daw/DawPage';

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
    <DawPage />
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

