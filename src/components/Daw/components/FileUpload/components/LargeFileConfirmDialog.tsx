import * as Dialog from '@radix-ui/react-dialog';
import * as styles from '../FileUpload.css';

interface LargeFileConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileSize: string; // 포맷팅된 파일 크기 (예: "539MB")
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 큰 파일 업로드 확인 다이얼로그 컴포넌트
 * 100MB보다 큰 파일을 업로드하려고 할 때 사용자에게 확인을 받습니다.
 */
export function LargeFileConfirmDialog({
  open,
  onOpenChange,
  fileSize,
  onConfirm,
  onCancel,
}: LargeFileConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content className={styles.dialogContent}>
          <Dialog.Title className={styles.dialogTitle}>
            큰 파일 업로드 확인
          </Dialog.Title>
          <Dialog.Description className={styles.dialogDescription}>
            {fileSize}의 파일을 업로드하려고 합니다.
            <br />
            계속하시겠습니까?
          </Dialog.Description>
          <div className={styles.dialogActions}>
            <button
              type="button"
              onClick={handleCancel}
              className={styles.dialogCancelButton}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={styles.dialogConfirmButton}
            >
              업로드
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}




