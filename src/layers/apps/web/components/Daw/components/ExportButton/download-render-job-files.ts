import type { RenderJobResult } from '@/layers/shared/types/render-job';
import { downloadBlob } from './utils/audioExport';

export function downloadRenderJobFiles(result: RenderJobResult): void {
  result.files.forEach(file => downloadBlob(file.blob, file.fileName));
}
