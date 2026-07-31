import { Navigate, Route, Routes } from 'react-router-dom';
import { DawPage } from '@/layers/apps/web/components/Daw/DawPage';
import { DropPage } from '@/layers/apps/web/components/Daw/components/Drop/DropPage';
import { CliTestPage } from '../../cli/cli-test-page';
import { ProjectRouteGuard } from './ProjectRouteGuard';
import { LoginPage } from '../components/Auth/LoginPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<DropPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<LoginPage />} />
      <Route path="/preview" element={<Navigate to="/daw" replace />} />
      <Route
        path="/daw"
        element={
          <ProjectRouteGuard>
            <DawPage />
          </ProjectRouteGuard>
        }
      />
      <Route path="/cli-test" element={<CliTestPage />} />
    </Routes>
  );
}
