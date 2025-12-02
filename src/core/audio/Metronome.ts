/**
 * Metronome - 메트로놈 시스템
 * AudioWorklet을 사용하여 실시간 클릭 사운드 생성
 */
import { METRONOME_WORKLET_URL } from '../../constants/audio';
export class Metronome {
  private context: AudioContext;
  private bpm: number;
  private workletNode: AudioWorkletNode | null = null;
  private isInitialized: boolean = false;
  private enabled: boolean = false;
  private isConnected: boolean = false;

  constructor(context: AudioContext, bpm: number) {
    this.context = context;
    this.bpm = bpm;
  }

  /**
   * 초기화 상태 확인
   */
  getIsReady(): boolean {
    return this.isInitialized;
  }

  /**
   * AudioWorklet 초기화
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // AudioWorklet 모듈 로드
      await this.context.audioWorklet.addModule(METRONOME_WORKLET_URL);

      // AudioWorkletNode 생성
      this.workletNode = new AudioWorkletNode(
        this.context,
        'metronome-processor'
      );

      this.isInitialized = true;
    } catch (error) {
      console.error('AudioWorklet 초기화 실패:', error);
    }
  }

  /**
   * GainNode에 연결
   */
  async connect(destination: AudioNode): Promise<void> {
    await this.initialize();
    if (this.workletNode && !this.isConnected) {
      this.workletNode.connect(destination);
      this.isConnected = true;
    }
  }

  /**
   * 연결 해제
   */
  disconnect(): void {
    if (!this.workletNode) return;
    this.workletNode.disconnect();
  }

  /**
   * 메트로놈 활성화/비활성화
   */
  async setEnabled(enabled: boolean): Promise<void> {
    await this.initialize();

    this.enabled = enabled;

    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'enable',
        value: enabled,
      });
    }
  }

  /**
   * BPM 설정
   */
  async setBPM(bpm: number): Promise<void> {
    await this.initialize();

    this.bpm = bpm;

    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'bpm',
        value: bpm,
      });
    }
  }

  /**
   * 현재 BPM 가져오기
   */
  getBPM(): number {
    return this.bpm;
  }

  /**
   * 메트로놈이 활성화되어 있는지 확인
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    this.setEnabled(false);
    this.disconnect();
    this.workletNode = null;
    this.isInitialized = false;
  }
}
