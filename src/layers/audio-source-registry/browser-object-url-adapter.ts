import type { IObjectUrlAdapter } from './i-object-url-adapter';

export class BrowserObjectUrlAdapter implements IObjectUrlAdapter {
  createObjectUrl(blob: Blob): string {
    return globalThis.URL.createObjectURL(blob);
  }

  revokeObjectUrl(objectUrl: string): void {
    globalThis.URL.revokeObjectURL(objectUrl);
  }
}
