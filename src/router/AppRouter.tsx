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

