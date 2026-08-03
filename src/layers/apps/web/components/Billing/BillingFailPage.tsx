import { Link, useLocation } from 'react-router-dom';
import { readBillingFailureCode } from '../../billing/billing-callback';
import * as styles from './BillingPage.css';

export function BillingFailPage() {
  const location = useLocation();
  const failureCode = readBillingFailureCode(location.search);

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="billing-fail-title">
        <span className={styles.brand}>DROP.AI PRO</span>
        <h1 id="billing-fail-title" className={styles.title}>
          카드 등록을 완료하지 못했습니다
        </h1>
        <p className={styles.description}>결제되지 않았습니다. 구독 화면에서 다시 시도할 수 있습니다.</p>
        {failureCode && <p className={styles.notice}>오류 코드: {failureCode}</p>}
        <div className={styles.actionRow}>
          <Link className={styles.primaryAction} to="/billing">
            다시 시도하기
          </Link>
          <Link className={styles.secondaryAction} to="/daw">
            편집기로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}
