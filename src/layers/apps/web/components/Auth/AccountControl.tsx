import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthClient, useAuthSnapshot } from '@/layers/apps/web/context/layer-hooks';
import * as styles from './AccountControl.css.ts';

export function AccountControl() {
  const authClient = useAuthClient();
  const authSnapshot = useAuthSnapshot();
  const [isPending, setIsPending] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (authSnapshot.status === 'loading' || authSnapshot.status === 'unavailable') {
    return null;
  }

  if (authSnapshot.status === 'anonymous') {
    return (
      <div className={styles.container}>
        <Link className={styles.action} to="/login">
          LOG IN
        </Link>
      </div>
    );
  }

  const handleSignOut = async (): Promise<void> => {
    setIsPending(true);
    setHasError(false);

    try {
      await authClient.signOut();
    } catch {
      setHasError(true);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className={styles.container}>
      <span className={styles.email} title={authSnapshot.user.email ?? authSnapshot.user.id}>
        {authSnapshot.user.email ?? 'SIGNED IN'}
      </span>
      <button className={styles.action} type="button" onClick={handleSignOut} disabled={isPending}>
        {isPending ? '...' : 'LOG OUT'}
      </button>
      {hasError && (
        <span className={styles.error} role="alert">
          로그아웃 실패
        </span>
      )}
    </div>
  );
}
