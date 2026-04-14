import { Routes, Route } from 'react-router-dom';
import { CliTestPage } from '../layers/apps/cli/cli-test-page';
import { WebDAW } from '@/layers/apps/web/WebDAW';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<CliTestPage />} />
      <Route path="/cli-test" element={<CliTestPage />} />
      <Route path="/web-daw" element={<WebDAW />} />
    </Routes>
  );
}
