export interface IObjectUrlAdapter {
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(objectUrl: string): void;
}
