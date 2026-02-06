import * as Tone from 'tone';
import { Session } from '../session/Session';
import { AudioPort } from '../audio/io/AudioPort';

/**
 * AutomationEngine
 * 
 * Handles the scheduling and application of automation data.
 * It runs a loop synchronized with Tone.Transport to apply 
 * time-varying parameters (Volume, Pan) to AudioPorts.
 */
export class AutomationEngine {
    private eventId: number | null = null;

    constructor(
        private session: Session,
        private getPort: (trackId: string) => AudioPort | undefined
    ) {
        this.startLoop();
    }

    private startLoop() {
        // Update automation every 0.1 seconds (approx 10Hz control rate)
        this.eventId = Tone.Transport.scheduleRepeat((_time) => {
            const currentTime = Tone.Transport.seconds;

            this.session.tracks.forEach(track => {
                const port = this.getPort(track.id);
                if (!port) return;

                // 1. Volume Automation
                const volConfig = track.automations.get('volume');
                if (volConfig && volConfig.getPoints().length > 0) {
                    const val = volConfig.getValueAt(currentTime);
                    port.volume = val;
                }

                // 2. Pan Automation
                const panConfig = track.automations.get('pan');
                if (panConfig && panConfig.getPoints().length > 0) {
                    const val = panConfig.getValueAt(currentTime);
                    port.pan = val;
                }
            });
        }, "0.1");
    }

    dispose() {
        if (this.eventId !== null) {
            Tone.Transport.clear(this.eventId);
        }
    }
}
