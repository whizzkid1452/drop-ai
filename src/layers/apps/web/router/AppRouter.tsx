import { Routes, Route } from 'react-router-dom';
import { DawPage } from '@/layers/apps/web/components/Daw/DawPage';
import { DropPage } from '@/layers/apps/web/components/Daw/components/Drop/DropPage';
import { CliTestPage } from '../../cli/cli-test-page';
import { AgentPreviewPage } from '@/layers/apps/web/components/Preview/AgentPreviewPage';
import { ProjectRouteGuard } from './ProjectRouteGuard';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<DropPage />} />
      <Route
        path="/preview"
        element={
          <ProjectRouteGuard>
            <AgentPreviewPage />
          </ProjectRouteGuard>
        }
      />
      <Route
        path="/daw"
        element={
          <ProjectRouteGuard requiresAgentResult>
            <DawPage />
          </ProjectRouteGuard>
        }
      />
      <Route path="/cli-test" element={<CliTestPage />} />
    </Routes>
  );
}
