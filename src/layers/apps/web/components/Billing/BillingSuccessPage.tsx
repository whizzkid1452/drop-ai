import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { useAuthSnapshot, useBillingClient } from '@/layers/apps/web/context/layer-hooks';
import { billingQueryKeys } from '../../billing/billing-queries';
import { readBillingActivationCallback } from '../../billing/billing-callback';
import * as styles from './BillingPage.css';

type ActivationStatus = 'idle' | 'pending' | 'complete' | 'error';

export function BillingSuccessPage() {
  const location = useLocation();
  const authSnapshot = useAuthSnapshot();
  const billingClient = useBillingClient();
  const queryClient = useQueryClient();
  const activationRequest = readBillingActivationCallback(location.search);
  const activationKey = activationRequest ? `${activationRequest.customerKey}:${activationRequest.authKey}` : null;
  const attemptedActivationKeyRef = useRef<string | null>(null);
  const [activationStatus, setActivationStatus] = useState<ActivationStatus>('idle');

  useEffect(() => {
    if (
      authSnapshot.status !== 'authenticated' ||
      !activationRequest ||
      !activationKey ||
      attemptedActivationKeyRef.current === activationKey
    ) {
      return;
    }

    attemptedActivationKeyRef.current = activationKey;
    setActivationStatus('pending');
    void billingClient
      .activateSubscription(activationRequest)
      .then(async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription(authSnapshot.user.id) }),
          queryClient.invalidateQueries({ queryKey: billingQueryKeys.entitlement(authSnapshot.user.id) }),
        ]);
        setActivationStatus('complete');
      })
      .catch(() => setActivationStatus('error'));
  }, [activationKey, activationRequest, authSnapshot, billingClient, queryClient]);

  const isAuthUnavailable = authSnapshot.status === 'unavailable';
  const isAnonymous = authSnapshot.status === 'anonymous';
  const isInvalidCallback = !activationRequest;

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="billing-success-title">
        <span className={styles.brand}>DROP.AI PRO</span>
        <h1 id="billing-success-title" className={styles.title}>
          카드 등록 결과 확인
        </h1>

        {authSnapshot.status === 'loading' && <p className={styles.description}>로그인 상태를 확인하고 있습니다.</p>}
        {isAuthUnavailable && (
          <p className={styles.error} role="alert">
            로그인 설정이 없어 카드 등록을 완료할 수 없습니다.
          </p>
        )}
        {isAnonymous && (
          <p className={styles.error} role="alert">
            카드 등록을 요청한 계정의 로그인이 만료되었습니다.
          </p>
        )}
        {isInvalidCallback && (
          <p className={styles.error} role="alert">
            카드 등록 결과가 올바르지 않습니다.
          </p>
        )}
        {activationStatus === 'pending' && (
          <p className={styles.description}>빌링키를 저장하고 첫 결제를 요청하고 있습니다.</p>
        )}
        {activationStatus === 'complete' && (
          <p className={styles.success} role="status">
            카드 등록을 완료했습니다. 첫 결제 승인 상태는 구독 화면에서 확인할 수 있습니다.
          </p>
        )}
        {activationStatus === 'error' && (
          <p className={styles.error} role="alert">
            카드 등록을 완료하지 못했습니다. 같은 계정으로 다시 시도해주세요.
          </p>
        )}

        <div className={styles.actionRow}>
          <Link className={styles.primaryAction} to="/billing">
            구독 상태 보기
          </Link>
          <Link className={styles.secondaryAction} to="/daw">
            편집기로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}
