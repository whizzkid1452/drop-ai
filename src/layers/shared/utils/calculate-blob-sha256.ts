export class Sha256UnavailableError extends Error {
  constructor() {
    super('Web Crypto SHA-256 API를 사용할 수 없습니다.');
    this.name = 'Sha256UnavailableError';
  }
}

export async function calculateBlobSha256(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Sha256UnavailableError();
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
