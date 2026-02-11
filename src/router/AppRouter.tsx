import { Routes, Route } from 'react-router-dom';
import { DawPage } from '@/layers/apps/web/components/Daw/DawPage';
import { DropPage } from '@/layers/apps/web/components/Daw/components/Drop/DropPage';
import { CliTestPage } from '../layers/apps/cli/cli-test-page';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<DropPage />} />
      <Route path="/daw" element={<DawPage />} />
      <Route path="/cli-test" element={<CliTestPage />} />
    </Routes>
  );
}
