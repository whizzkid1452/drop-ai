import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthClient, useAuthSnapshot } from '@/layers/apps/web/context/layer-hooks';
import { createAuthCallbackUrl } from '../../auth/create-auth-callback-url';
import * as styles from './LoginPage.css.ts';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '로그인 이메일을 보내지 못했습니다.';
}

export function LoginPage() {
  const authClient = useAuthClient();
  const authSnapshot = useAuthSnapshot();
  const [email, setEmail] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (authSnapshot.status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  if (authSnapshot.status === 'unavailable') {
    return (
      <main className={styles.page}>
        <section className={styles.panel} aria-labelledby="login-title">
          <span className={styles.brand}>DROP.AI</span>
          <h1 id="login-title" className={styles.title}>
            로그인 설정이 필요합니다
          </h1>
          <p className={styles.description}>Supabase 공개 환경변수를 설정한 뒤 다시 실행해주세요.</p>
          <Link className={styles.backLink} to="/">
            편집기로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  if (authSnapshot.status === 'loading') {
    return (
      <main className={styles.page}>
        <p className={styles.statusMessage}>로그인 상태를 확인하고 있습니다.</p>
      </main>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsPending(true);
    setIsComplete(false);
    setErrorMessage(null);

    try {
      await authClient.signInWithMagicLink({
        email: email.trim(),
        callbackUrl: createAuthCallbackUrl({
          origin: window.location.origin,
          basePath: import.meta.env.BASE_URL,
        }),
      });
      setIsComplete(true);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="login-title">
        <span className={styles.brand}>DROP.AI</span>
        <h1 id="login-title" className={styles.title}>
          이메일로 로그인
        </h1>
        <p className={styles.description}>비밀번호 없이 이메일로 받은 Magic Link를 사용합니다.</p>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="login-email">
            이메일
          </label>
          <input
            id="login-email"
            className={styles.input}
            type="email"
            autoComplete="email"
            value={email}
            onChange={event => setEmail(event.currentTarget.value)}
            required
            disabled={isPending}
          />
          <button className={styles.submitButton} type="submit" disabled={isPending}>
            {isPending ? '보내는 중...' : '로그인 링크 받기'}
          </button>
        </form>
        {isComplete && (
          <p className={styles.statusMessage} role="status">
            이메일을 확인해주세요.
          </p>
        )}
        {errorMessage && (
          <p className={styles.errorMessage} role="alert">
            {errorMessage}
          </p>
        )}
        <Link className={styles.backLink} to="/">
          편집기로 돌아가기
        </Link>
      </section>
    </main>
  );
}
