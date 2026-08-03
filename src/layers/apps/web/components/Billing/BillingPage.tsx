import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthSnapshot, useBillingClient } from '@/layers/apps/web/context/layer-hooks';
import { billingQueryKeys, useBillingPlanQuery, useBillingSubscriptionQuery } from '../../billing/billing-queries';
import type { BillingSubscription } from '@/layers/billing/i-billing-client';
import * as styles from './BillingPage.css';

function formatKrw(amountKrw: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(amountKrw)}원`;
}

function formatPeriodEnd(currentPeriodEnd: string | null): string {
  if (!currentPeriodEnd) {
    return '결제 완료 후 표시됩니다.';
  }

  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(new Date(currentPeriodEnd));
}

function getSubscriptionCopy(subscription: BillingSubscription): {
  readonly title: string;
  readonly description: string;
} {
  switch (subscription.status) {
    case 'pending':
      return {
        title: '첫 결제를 확인하고 있습니다',
        description: '승인 결과를 확인하면 구독 상태가 자동으로 갱신됩니다.',
      };
    case 'active':
      return {
        title: 'Pro 구독 사용 중',
        description: `다음 결제일: ${formatPeriodEnd(subscription.currentPeriodEnd)}${
          subscription.cardLastFour ? ` · 카드 끝자리 ${subscription.cardLastFour}` : ''
        }`,
      };
    case 'cancel_at_period_end':
      return {
        title: '구독 취소 예약됨',
        description: `${formatPeriodEnd(subscription.currentPeriodEnd)}까지 Pro 기능을 사용할 수 있습니다.`,
      };
    case 'past_due':
      return {
        title: '결제를 완료하지 못했습니다',
        description: '카드를 다시 등록하면 Pro 구독을 재개할 수 있습니다.',
      };
    case 'canceled':
    case 'none':
      return {
        title: '현재 구독이 없습니다',
        description: '카드를 등록하면 첫 결제를 처리한 뒤 Pro 기능이 열립니다.',
      };
  }
}

export function BillingPage() {
  const authSnapshot = useAuthSnapshot();
  const billingClient = useBillingClient();
  const queryClient = useQueryClient();
  const planQuery = useBillingPlanQuery();
  const subscriptionQuery = useBillingSubscriptionQuery();
  const startSubscription = useMutation({
    mutationFn: () =>
      billingClient.requestBillingAuthorization(
        authSnapshot.status === 'authenticated' ? (authSnapshot.user.email ?? undefined) : undefined
      ),
  });
  const cancelSubscription = useMutation({
    mutationFn: () => billingClient.cancelSubscription(),
    onSuccess: async () => {
      if (authSnapshot.status !== 'authenticated') {
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription(authSnapshot.user.id) }),
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.entitlement(authSnapshot.user.id) }),
      ]);
    },
  });

  const subscription = subscriptionQuery.data;
  const subscriptionCopy = subscription ? getSubscriptionCopy(subscription) : null;
  const canStartSubscription =
    subscription?.status === 'none' || subscription?.status === 'canceled' || subscription?.status === 'past_due';
  const canCancelSubscription = subscription?.status === 'active';

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="billing-title">
        <span className={styles.brand}>DROP.AI PRO</span>
        <h1 id="billing-title" className={styles.title}>
          AI Terminal 구독
        </h1>
        <p className={styles.description}>
          자연어로 오디오 편집 명령을 만들고 실행하는 AI Terminal을 사용할 수 있습니다.
        </p>

        {planQuery.data ? (
          <>
            <p className={styles.price}>{formatKrw(planQuery.data.amountKrw)}</p>
            <span className={styles.interval}>매월 자동 결제 · KRW</span>
          </>
        ) : (
          <p className={styles.notice}>
            {planQuery.isError ? '가격 정보를 불러올 수 없습니다.' : '월 구독 가격을 확인하고 있습니다.'}
          </p>
        )}

        {authSnapshot.status === 'unavailable' && (
          <p className={styles.error} role="alert">
            로그인 설정을 먼저 완료해주세요.
          </p>
        )}

        {authSnapshot.status === 'loading' && <p className={styles.notice}>로그인 상태를 확인하고 있습니다.</p>}

        {authSnapshot.status === 'anonymous' && (
          <div className={styles.actionRow}>
            <Link className={styles.primaryAction} to="/login">
              로그인하고 구독하기
            </Link>
          </div>
        )}

        {authSnapshot.status === 'authenticated' && (
          <>
            {subscriptionCopy && (
              <div className={styles.statusBox}>
                <p className={styles.statusTitle}>{subscriptionCopy.title}</p>
                <p className={styles.statusDescription}>{subscriptionCopy.description}</p>
              </div>
            )}
            {subscriptionQuery.isPending && <p className={styles.notice}>구독 상태를 확인하고 있습니다.</p>}
            {subscriptionQuery.isError && (
              <p className={styles.error} role="alert">
                구독 상태를 확인할 수 없습니다.
              </p>
            )}

            <div className={styles.actionRow}>
              {canStartSubscription && (
                <button
                  className={styles.primaryAction}
                  type="button"
                  onClick={() => startSubscription.mutate()}
                  disabled={!planQuery.data || startSubscription.isPending}
                >
                  {startSubscription.isPending ? '카드 등록창 여는 중...' : '카드 등록하고 시작하기'}
                </button>
              )}
              {canCancelSubscription && (
                <button
                  className={styles.secondaryAction}
                  type="button"
                  onClick={() => cancelSubscription.mutate()}
                  disabled={cancelSubscription.isPending}
                >
                  {cancelSubscription.isPending ? '처리 중...' : '다음 결제 취소 예약'}
                </button>
              )}
              <Link className={styles.secondaryAction} to="/daw">
                편집기로 돌아가기
              </Link>
            </div>
          </>
        )}

        {(startSubscription.isError || cancelSubscription.isError) && (
          <p className={styles.error} role="alert">
            결제 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.
          </p>
        )}
        {cancelSubscription.isSuccess && (
          <p className={styles.success} role="status">
            현재 이용 기간 종료 시점으로 취소를 예약했습니다.
          </p>
        )}
        <p className={styles.notice}>
          첫 카드 등록 직후 첫 결제가 진행됩니다. 구독을 취소해도 결제된 이용 기간이 끝날 때까지 Pro 기능을 사용할 수
          있습니다.
        </p>
      </section>
    </main>
  );
}
