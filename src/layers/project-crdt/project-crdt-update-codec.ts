const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const BINARY_STRING_CHUNK_SIZE = 32_768;

export function encodeProjectCrdtUpdate(update: Uint8Array): string {
  if (update.byteLength === 0) {
    throw new Error('빈 CRDT update는 인코딩할 수 없습니다.');
  }

  const binaryChunks: string[] = [];
  for (let offset = 0; offset < update.byteLength; offset += BINARY_STRING_CHUNK_SIZE) {
    binaryChunks.push(String.fromCharCode(...update.subarray(offset, offset + BINARY_STRING_CHUNK_SIZE)));
  }
  return globalThis.btoa(binaryChunks.join(''));
}

export function decodeProjectCrdtUpdate(encodedUpdate: string): Uint8Array {
  if (!isEncodedProjectCrdtUpdate(encodedUpdate)) {
    throw new Error('CRDT update Base64 형식이 유효하지 않습니다.');
  }

  const binary = globalThis.atob(encodedUpdate);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export function isEncodedProjectCrdtUpdate(value: string): boolean {
  return value.length > 0 && BASE64_PATTERN.test(value);
}
