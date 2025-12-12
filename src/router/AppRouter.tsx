import { Routes, Route } from 'react-router-dom';
import { DawPage } from '@/components/Daw/DawPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<DawPage />} />
    </Routes>
  );
}

