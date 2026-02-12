import { type IAudioEngine, type ExportOptions } from '@/layers/audio-engine';
import { type SessionStore } from '@/layers/session';

export class ExportController {
  constructor(
    private sessionStore: SessionStore,
    private audioEngine: IAudioEngine
  ) {}

  setExportRange(startTime: number | null, endTime: number | null): void {
    console.log(`[ExportController] Setting export range: ${startTime} - ${endTime}`);

    this.audioEngine.setExportRange(startTime, endTime);
    
    // Update Session State (via injected store, assuming it's available or need to change constructor)
    // Constructor has `_sessionStore`. I need to change it to `private sessionStore`.
    this.sessionStore.getState().setExportRange(startTime, endTime);
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
