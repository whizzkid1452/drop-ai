import type { IAudioEngine, ExportOptions } from '../audio-engine/i-audio-engine';
import { type SessionStore } from '../session/session';

export class ExportController {
  constructor(
    _sessionStore: SessionStore, // 미사용이지만 AppController 패턴 일관성 유지
    private audioEngine: IAudioEngine
  ) {}

  setExportRange(startTime: number | null, endTime: number | null): void {
    console.log(`[ExportController] Setting export range: ${startTime} - ${endTime}`);

    this.audioEngine.setExportRange(startTime, endTime);
  }

  async exportProject(): Promise<Blob> {
    console.log('[ExportController] Exporting entire project');

    const blob = await this.audioEngine.exportProject();
    return blob;
  }

  async exportRange(startTime: number, endTime: number): Promise<Blob> {
    console.log(`[ExportController] Exporting range: ${startTime} - ${endTime}`);

    const options: ExportOptions = {
      range: { startTime, endTime }
    };

    const blob = await this.audioEngine.exportProject(options);
    return blob;
  }
}
