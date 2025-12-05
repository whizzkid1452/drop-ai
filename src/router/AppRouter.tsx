import { Routes, Route } from 'react-router-dom';
import { DropZoneView, HomeView, DawView } from '@/App';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomeView />} />
      <Route path="/daw" element={<DawView />} />
      <Route path="/dropzone" element={<DropZoneView />} />
    </Routes>
  );
}

