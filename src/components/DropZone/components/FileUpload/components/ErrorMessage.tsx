import * as styles from '../FileUpload.css';

interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  return <div className={styles.errorMessage}>{message}</div>;
}






