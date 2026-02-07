import { Routes, Route } from 'react-router-dom';
import { DawPage } from '@/UI/components/Daw/DawPage';
import { DropPage } from '@/UI/components/Drop/DropPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<DropPage />} />
      <Route path="/daw" element={<DawPage />} />
    </Routes>
  );
}
