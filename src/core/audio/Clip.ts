/**
 * Clip - 오디오 클립
 * Ardour의 Region 개념을 구현
 */
export class Clip {
  private buffer: AudioBuffer;
  private gainNode: GainNode;
  private sourceNode: AudioBufferSourceNode | null = null;
  private outputNode: GainNode;
  private startTime: number;
  private duration: number;
  private isPlaying: boolean = false;
  private paused: boolean = false;
  private pausePosition: number = 0;
  private playStartTime: number = 0; // 재생이 시작된 AudioContext 시간

  constructor(context: AudioContext, buffer: AudioBuffer, startTime: number) {
    this.buffer = buffer;
    this.startTime = startTime;
    this.duration = buffer.duration;

    // Gain 노드 생성 (추후 볼륨 페이딩 등에 활용)
    this.gainNode = context.createGain();
    this.outputNode = context.createGain();
    this.gainNode.connect(this.outputNode);
  }

  /**
   * 클립 시작 시간 가져오기
   */
  getStartTime(): number {
    return this.startTime;
  }

  /**
   * 클립 시작 시간 설정
   */
  setStartTime(startTime: number): void {
    this.startTime = startTime;
  }

  /**
   * 클립 지속 시간 가져오기
   */
  getDuration(): number {
    return this.duration;
  }

  /**
   * 오디오 버퍼 가져오기
   */
  getBuffer(): AudioBuffer {
    return this.buffer;
  }

  /**
   * GainNode에 연결
   */
  connect(destination: AudioNode): void {
    this.outputNode.connect(destination);
  }

  /**
   * 연결 해제
   */
  disconnect(): void {
    this.outputNode.disconnect();
  }

  /**
   * 클립 재생
   */
  play(_currentTime: number, transportPosition: number): void {
    // 이미 재생 중이면 스킵
    if (this.isPlaying && !this.paused) return;

    // 클립의 시작 오프셋 계산
    const clipOffset = Math.max(0, transportPosition - this.startTime);

    // 클립 범위를 벗어나면 재생하지 않음
    if (clipOffset >= this.duration) {
      return;
    }

    const context = this.gainNode.context as AudioContext;
    const source = context.createBufferSource();
    source.buffer = this.buffer;

    // Gain 노드에 연결
    source.connect(this.gainNode);

    // 재생 시작 (즉시 재생, 오프셋만큼 건너뛰기)
    source.start(0, clipOffset);

    this.sourceNode = source;
    this.playStartTime = context.currentTime;
    this.isPlaying = true;
    this.paused = false;

    // 재생 완료 시 정리
    source.onended = () => {
      this.isPlaying = false;
      this.sourceNode = null;
    };
  }

  /**
   * 클립 정지
   */
  stop(): void {
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.isPlaying = false;
    this.paused = false;
    this.pausePosition = 0;
  }

  /**
   * 클립 일시정지
   */
  pause(transportPosition?: number): void {
    if (this.sourceNode && this.isPlaying) {
      // transport position이 전달되면 사용, 아니면 계산
      if (transportPosition !== undefined) {
        this.pausePosition = transportPosition;
      } else {
        // transport position이 없으면 경과 시간으로 근사치 계산
        const context = this.gainNode.context as AudioContext;
        const elapsed = context.currentTime - this.playStartTime;
        const clipOffset = Math.max(0, elapsed);
        this.pausePosition = this.startTime + clipOffset;
      }
      
      // sourceNode 정지 및 정리
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.sourceNode = null;
      
      this.isPlaying = false;
      this.paused = true;
    }
  }

  /**
   * 클립 재개
   */
  resume(currentTime: number): void {
    if (this.paused) {
      // pausePosition을 사용하여 재생 재개
      this.play(currentTime, this.pausePosition);
      this.paused = false;
    }
  }

  /**
   * 재생 위치 업데이트
   */
  updatePosition(position: number): void {
    // 클립이 재생 범위에 있는지 확인
    const isInRange =
      position >= this.startTime && position <= this.startTime + this.duration;

    // 범위를 벗어나면 정지
    if (!isInRange && this.isPlaying) {
      this.stop();
    }

    // 범위에 들어오고 재생 중이 아니라면 시작
    if (isInRange && !this.isPlaying) {
      const context = this.gainNode.context;
      this.play(context.currentTime, position);
    }
  }

  /**
   * 페이드 인 설정
   */
  setFadeIn(_duration: number): void {
    // TODO: 페이드 인 구현
  }

  /**
   * 페이드 아웃 설정
   */
  setFadeOut(_duration: number): void {
    // TODO: 페이드 아웃 구현
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    this.stop();
    this.gainNode.disconnect();
    this.outputNode.disconnect();
  }
}
