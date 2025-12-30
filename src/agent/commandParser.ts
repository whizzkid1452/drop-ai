import { AudioCommandType } from '@/types/audioEngine';
import type { AudioCommand } from '@/types/audioEngine';
import type { Track } from '@/types/track';

export interface CommandParserDependencies {
    handleAudioCommand: (command: AudioCommand) => Promise<any>;
    getTracks: () => Track[];
}

/**
 * 자연어 명령어를 파싱하고 실행하는 함수
 * @param userInput 사용자 입력
 * @param deps 의존성 (handleAudioCommand, getTracks)
 * @returns 실행 결과 메시지 또는 null (명령어가 아닌 경우)
 */
export async function parseAndExecuteCommand(
    userInput: string,
    deps: CommandParserDependencies
): Promise<string | null> {
    const lowerInput = userInput.toLowerCase();
    const { handleAudioCommand, getTracks } = deps;

    // 한국어/영어 키워드 매핑
    const commandMap = {
        play: ['play', '재생', '플레이', '시작'],
        pause: ['pause', '일시정지', '일시 정지', '멈춰', '멈춤'],
        stop: ['stop', '스톱', '중지', '정지'],
    };

    try {
        // PLAY 명령어
        if (commandMap.play.some(kw => lowerInput.includes(kw))) {
            await handleAudioCommand({ type: AudioCommandType.PLAY });
            return '✅ 재생을 시작했습니다.';
        }

        // PAUSE 명령어
        if (commandMap.pause.some(kw => lowerInput.includes(kw))) {
            await handleAudioCommand({ type: AudioCommandType.PAUSE });
            return '⏸ 일시정지했습니다.';
        }

        // STOP 명령어
        if (commandMap.stop.some(kw => lowerInput.includes(kw))) {
            await handleAudioCommand({ type: AudioCommandType.STOP });
            return '⏹ 정지했습니다.';
        }

        // 볼륨 조절 (예: "볼륨 50으로", "volume 70", "볼륨을 80%로")
        const volumeMatch = lowerInput.match(/(?:볼륨|volume)[을를]?\s*(\d+)/);
        if (volumeMatch) {
            const volumePercent = parseInt(volumeMatch[1]);
            const volume = Math.min(100, Math.max(0, volumePercent)) / 100;
            const tracks = getTracks();

            if (tracks.length > 0) {
                await handleAudioCommand({
                    type: AudioCommandType.SET_TRACK_VOLUME,
                    trackId: tracks[0].id,
                    volume
                });
                return `🔊 볼륨을 ${Math.round(volume * 100)}%로 설정했습니다.`;
            } else {
                return '⚠️ 트랙이 없습니다.';
            }
        }

        // 패닝 조절 (예: "왼쪽으로", "오른쪽으로", "pan left", "pan right", "중앙")
        const panLeftMatch = lowerInput.match(/(?:왼쪽|left)/);
        const panRightMatch = lowerInput.match(/(?:오른쪽|right)/);
        const panCenterMatch = lowerInput.match(/(?:중앙|center|가운데)/);

        if (panLeftMatch || panRightMatch || panCenterMatch) {
            const tracks = getTracks();

            if (tracks.length > 0) {
                let pan = 0;
                let panLabel = '';

                if (panLeftMatch) {
                    pan = -1;
                    panLabel = '왼쪽';
                } else if (panRightMatch) {
                    pan = 1;
                    panLabel = '오른쪽';
                } else {
                    pan = 0;
                    panLabel = '중앙';
                }

                await handleAudioCommand({
                    type: AudioCommandType.SET_TRACK_PAN,
                    trackId: tracks[0].id,
                    pan
                });
                return `🎧 패닝을 ${panLabel}으로 설정했습니다.`;
            } else {
                return '⚠️ 트랙이 없습니다.';
            }
        }

    } catch (err: any) {
        console.error('[Command Execution Error]', err);
        return `❌ 명령어 실행 실패: ${err.message}`;
    }

    return null; // 명령어가 아닌 경우
}

