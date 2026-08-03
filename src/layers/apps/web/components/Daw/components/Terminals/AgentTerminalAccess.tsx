import { Link } from 'react-router-dom';
import { useAccountEntitlementQuery } from '@/layers/apps/web/billing/billing-queries';
import { useAuthSnapshot } from '@/layers/apps/web/context/layer-hooks';
import { hasActiveProEntitlement } from '@/layers/billing/account-entitlement';
import { AgentTerminal } from './AgentTerminal/AgentTerminal';
import * as styles from './AgentTerminalAccess.css';

interface AccessMessageProps {
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly actionPath?: string;
}

function AccessMessage({ title, description, actionLabel, actionPath }: AccessMessageProps) {
  return (
    <div className={styles.container}>
      <span className={styles.badge}>DROP.AI PRO</span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      {actionLabel && actionPath && (
        <Link className={styles.action} to={actionPath}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function AgentTerminalAccess() {
  const authSnapshot = useAuthSnapshot();
  const entitlementQuery = useAccountEntitlementQuery();

  if (authSnapshot.status === 'unavailable') {
    // 인증 도입 전부터 동작하던 로컬 편집 환경은 설정 누락만으로 차단하지 않는다.
    return <AgentTerminal />;
  }

  if (authSnapshot.status === 'loading') {
    return <AccessMessage title="계정 확인 중" description="AI Terminal 사용 권한을 확인하고 있습니다." />;
  }

  if (authSnapshot.status === 'anonymous') {
    return (
      <AccessMessage
        title="로그인이 필요합니다"
        description="AI Terminal은 Pro 계정에서 사용할 수 있습니다."
        actionLabel="로그인하기"
        actionPath="/login"
      />
    );
  }

  if (entitlementQuery.isPending) {
    return <AccessMessage title="권한 확인 중" description="Pro 구독 상태를 확인하고 있습니다." />;
  }

  if (entitlementQuery.isError || !entitlementQuery.data) {
    return (
      <AccessMessage
        title="권한을 확인할 수 없습니다"
        description="잠시 후 다시 시도하거나 구독 화면에서 상태를 확인해주세요."
        actionLabel="구독 상태 보기"
        actionPath="/billing"
      />
    );
  }

  if (hasActiveProEntitlement(entitlementQuery.data)) {
    return <AgentTerminal />;
  }

  return (
    <AccessMessage
      title="Pro 구독이 필요합니다"
      description="구독을 시작하면 AI Terminal이 열립니다. CLI Terminal은 무료로 계속 사용할 수 있습니다."
      actionLabel="Pro 구독 보기"
      actionPath="/billing"
    />
  );
}
