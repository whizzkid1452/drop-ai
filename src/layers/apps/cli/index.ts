import { useMemo } from 'react';
import { useController, useSession } from '../../presentation/context/LayerContext';
import { AppController } from '../../controllers/app-controller';

export interface CliCommand {
  description: string;
  usage: string;
  fn: (...args: any[]) => string | Promise<string>;
}

export type CliCommands = Record<string, CliCommand>;

export const createCliCommands = (
  controller: AppController, 
  state: { isPlaying: boolean; trackCount: number }
): CliCommands => ({
  play: {
    description: '오디오 재생을 시작합니다.',
    usage: 'play',
    fn: async () => {
      await controller.playback.handlePlay();
      return '재생을 시작합니다...';
    }
  },
  stop: {
    description: '오디오 재생을 중지합니다.',
    usage: 'stop',
    fn: () => {
      controller.playback.handleStop();
      return '재생을 중지했습니다.';
    }
  },
  pause: {
    description: '오디오 재생을 일시정지합니다.',
    usage: 'pause',
    fn: () => {
      controller.playback.handlePause();
      return '일시정지했습니다.';
    }
  },
  'add-track': {
    description: '새로운 가상 트랙을 추가합니다.',
    usage: 'add-track <id>',
    fn: async (id: string) => {
      if (!id) return '오류: 트랙 ID를 입력해주세요.';
      await controller.track.addTrack('mock-url', id);
      return '트랙 ' + id + '이(가) 추가되었습니다.';
    }
  },
  status: {
    description: '현재 세션 상태를 표시합니다.',
    usage: 'status',
    fn: () => {
      const statusText = state.isPlaying ? '재생 중' : '정지됨';
      return '현재 상태: ' + statusText + '\n등록된 트랙 수: ' + state.trackCount;
    }
  }
});

export const useCliApp = () => {
  const controller = useController();
  const isPlaying = useSession(state => state.isPlaying);
  const trackCount = useSession(state => state.tracks.size);
  const commands = useMemo(() => createCliCommands(controller, { isPlaying, trackCount }), [controller, isPlaying, trackCount]);
  return { isPlaying, trackCount, commands };
};
