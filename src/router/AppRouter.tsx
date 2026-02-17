import { Routes, Route } from 'react-router-dom';
import { DawPage } from '@/components/Daw/DawPage';
import { DropPage } from '@/components/Drop/DropPage';
import { CliTestPage } from '../layers/apps/cli/cli-test-page';
import { WebDAW } from '@/layers/apps/web/WebDAW';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<DropPage />} />
      <Route path="/daw" element={<DawPage />} />
      <Route path="/cli-test" element={<CliTestPage />} />
      <Route path="/web-daw" element={<WebDAW />} />
    </Routes>
  );
}
