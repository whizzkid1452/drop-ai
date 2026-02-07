import { useEffect, useRef } from 'react';
import { useAudioServiceActions } from '@/AudioEngine/FACADE/useAudioEngineFacade';
import { PushController } from '@/AudioEngine/control-surface/push/PushController';

export const MidiListener = () => {
    const controllerRef = useRef<PushController | null>(null);
    const { playNote, stopNote } = useAudioServiceActions();

    useEffect(() => {
        const controller = new PushController();
        controllerRef.current = controller;

        const connect = async () => {
            try {
                await controller.connect();

                if (controller.isConnected()) {
                    // ✅ 이벤트 핸들러 등록 - Facade hook 사용
                    controller.onPadPress = (note, velocity) => {
                        playNote(note, velocity);
                        // 시각적 피드백 (선택 사항)
                        controller.getPad(note)?.pulse(122); // White pulse
                    };

                    controller.onPadRelease = (note) => {
                        stopNote(note);
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
    }, [playNote, stopNote]);

    return null; // Headless component
};
