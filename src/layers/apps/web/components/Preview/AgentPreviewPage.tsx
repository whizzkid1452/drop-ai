import { useNavigate } from 'react-router-dom';
import { useSession } from '@/layers/apps/web/context/LayerContext';
import { AgentTerminal } from '@/layers/apps/web/components/Daw/components/Terminals/AgentTerminal/AgentTerminal';
import { PreviewActionBar } from './PreviewActionBar';
import * as styles from './AgentPreviewPage.css';
import type { AgentRunStatus } from '@/types/agent';

interface AgentPreviewContentProps {
  agentRunStatus: AgentRunStatus;
  onGoEdit: () => void;
}

export function AgentPreviewContent({ agentRunStatus, onGoEdit }: AgentPreviewContentProps) {
  const isPreviewReady = agentRunStatus === 'succeeded';
  const didAgentRunFail = agentRunStatus === 'failed';

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <h1 className={styles.title}>Describe your edit</h1>
        <p className={styles.description}>Ask the agent to edit the uploaded audio, then preview the applied result.</p>
      </header>

      <section className={styles.chatPanel} aria-label="Agent chat">
        <AgentTerminal />
      </section>

      {didAgentRunFail && (
        <p className={styles.errorMessage}>The edit was not fully applied. Update the request and try again.</p>
      )}

      {isPreviewReady && <PreviewActionBar onGoEdit={onGoEdit} />}
    </main>
  );
}

export function AgentPreviewPage() {
  const navigate = useNavigate();
  const agentRunStatus = useSession(state => state.agentRunStatus);

  return <AgentPreviewContent agentRunStatus={agentRunStatus} onGoEdit={() => navigate('/daw')} />;
}
