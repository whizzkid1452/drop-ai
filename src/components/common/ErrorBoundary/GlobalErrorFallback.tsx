import type { FallbackProps } from 'react-error-boundary';
import * as styles from './GlobalErrorFallback.css';

export function GlobalErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : '';

  return (
    <div className={styles.container}>
      <div className={styles.icon} role="img" aria-label="Error Alert">
        ⚠️
      </div>
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.message}>
        An unexpected error has occurred. Our team has been notified.
        Please try refreshing the page.
        {errorMessage}
      </p>
      
      <button className={styles.button} onClick={resetErrorBoundary}>
        Reload Application
      </button>

      {process.env.NODE_ENV === 'development' && errorStack && (
        <pre className={styles.codeStack}>
          <code>{errorStack}</code>
        </pre>
      )}
    </div>
  );
}
