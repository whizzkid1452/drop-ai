import { Routes, Route } from 'react-router-dom';
import { HomePage } from '@/components/Home/HomePage';
import { DropZonePage } from '@/components/DropZone/DropZonePage';
import { DawPage } from '@/components/Daw/DawPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/daw" element={<DawPage />} />
      <Route path="/dropzone" element={<DropZonePage />} />
    </Routes>
  );
}

