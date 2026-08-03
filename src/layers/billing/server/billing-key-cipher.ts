import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

interface BillingKeyCipher {
  encrypt(billingKey: string): string;
  decrypt(encryptedBillingKey: string): string;
}

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_LENGTH = 32;
const IV_LENGTH = 12;
const CIPHERTEXT_VERSION = 'v1';

export function createBillingKeyCipher(base64EncryptionKey: string): BillingKeyCipher {
  const encryptionKey = Buffer.from(base64EncryptionKey, 'base64');
  if (encryptionKey.length !== ENCRYPTION_KEY_LENGTH) {
    throw new Error('BILLING_KEY_ENCRYPTION_KEY는 base64로 인코딩한 32바이트 값이어야 합니다.');
  }

  return {
    encrypt: billingKey => {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);
      const ciphertext = Buffer.concat([cipher.update(billingKey, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();

      return [
        CIPHERTEXT_VERSION,
        iv.toString('base64url'),
        authTag.toString('base64url'),
        ciphertext.toString('base64url'),
      ].join('.');
    },
    decrypt: encryptedBillingKey => {
      const [version, encodedIv, encodedAuthTag, encodedCiphertext] = encryptedBillingKey.split('.');
      if (version !== CIPHERTEXT_VERSION || !encodedIv || !encodedAuthTag || !encodedCiphertext) {
        throw new Error('저장된 빌링키 암호문 형식이 올바르지 않습니다.');
      }

      const decipher = createDecipheriv(ALGORITHM, encryptionKey, Buffer.from(encodedIv, 'base64url'));
      decipher.setAuthTag(Buffer.from(encodedAuthTag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(encodedCiphertext, 'base64url')), decipher.final()]).toString(
        'utf8'
      );
    },
  };
}
