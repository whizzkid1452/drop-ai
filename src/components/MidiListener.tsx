import { AudioService } from "@/core/audio/AudioService";
import { useEffect, useRef } from 'react';
import { PushController } from '@/core/control-surface/push/PushController';

export const MidiListener = () => {
    const controllerRef = useRef<PushController | null>(null);

    useEffect(() => {
        const controller = new PushController();
        controllerRef.current = controller;
        const audioService = AudioService.getInstance();

        const connect = async () => {
            try {
                await controller.connect();

                if (controller.isConnected()) {
                    // 이벤트 핸들러 등록
                    controller.onPadPress = (note, velocity) => {
                        audioService.playNote(note, velocity);
                        // 시각적 피드백 (선택 사항)
                        controller.getPad(note)?.pulse(122); // White pulse
                    };

                    controller.onPadRelease = (note) => {
                        audioService.stopNote(note);
                    };
                }
            } catch (error) {
                console.error("Failed to connect controller:", error);
            }
        };

        connect();

        return () => {
            controller.disconnect();
        };
    }, []);

    return null; // Headless component
};
