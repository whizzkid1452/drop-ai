/**
 * Processor - 오디오 처리 체인을 위한 베이스 인터페이스
 * Ardour의 Processor 클래스를 참고하여 구현
 * 
 * Processor는 Route의 오디오 처리 체인에서 사용되는 기본 단위입니다.
 * Gain, Pan, Plugin 등이 모두 Processor의 구현체입니다.
 */

// Web Audio API 타입은 브라우저 내장이므로 별도 import 불필요

/**
 * Processor 활성화 상태
 */
export enum ProcessorState {
  Active = 'active',
  Inactive = 'inactive',
  Bypassed = 'bypassed',
}

/**
 * Processor 베이스 인터페이스
 */
export interface IProcessor {
  /**
   * Processor 이름
   */
  getName(): string;

  /**
   * Processor 활성화 상태
   */
  getState(): ProcessorState;

  /**
   * Processor 활성화
   */
  activate(): void;

  /**
   * Processor 비활성화
   */
  deactivate(): void;

  /**
   * Processor 우회 (Bypass)
   */
  bypass(): void;

  /**
   * Processor 우회 해제
   */
  unbypass(): void;

  /**
   * Processor가 활성 상태인지 확인
   */
  isActive(): boolean;

  /**
   * Processor가 우회 상태인지 확인
   */
  isBypassed(): boolean;

  /**
   * AudioNode 연결
   * @param destination 연결할 대상 노드
   */
  connect(destination: AudioNode): void;

  /**
   * 연결 해제
   */
  disconnect(): void;

  /**
   * 입력 노드 가져오기 (다음 프로세서로 연결)
   */
  getInputNode(): AudioNode | null;

  /**
   * 출력 노드 가져오기 (다음 프로세서로 연결)
   */
  getOutputNode(): AudioNode | null;

  /**
   * 리소스 정리
   */
  dispose(): void;
}

/**
 * Processor 베이스 클래스
 * 기본적인 활성화/비활성화 및 연결 관리 기능 제공
 */
export abstract class Processor implements IProcessor {
  protected name: string;
  protected state: ProcessorState = ProcessorState.Inactive;
  protected inputNode: AudioNode | null = null;
  protected outputNode: AudioNode | null = null;
  protected context: AudioContext;

  constructor(context: AudioContext, name: string) {
    this.context = context;
    this.name = name;
  }

  getName(): string {
    return this.name;
  }

  getState(): ProcessorState {
    return this.state;
  }

  activate(): void {
    if (this.state === ProcessorState.Bypassed) {
      this.unbypass();
    }
    this.state = ProcessorState.Active;
    this.onActivate();
  }

  deactivate(): void {
    this.state = ProcessorState.Inactive;
    this.onDeactivate();
  }

  bypass(): void {
    this.state = ProcessorState.Bypassed;
    this.onBypass();
  }

  unbypass(): void {
    if (this.state === ProcessorState.Bypassed) {
      this.state = ProcessorState.Active;
      this.onUnbypass();
    }
  }

  isActive(): boolean {
    return this.state === ProcessorState.Active;
  }

  isBypassed(): boolean {
    return this.state === ProcessorState.Bypassed;
  }

  abstract connect(destination: AudioNode): void;
  abstract disconnect(): void;
  abstract getInputNode(): AudioNode | null;
  abstract getOutputNode(): AudioNode | null;

  dispose(): void {
    this.disconnect();
    this.inputNode = null;
    this.outputNode = null;
  }

  /**
   * 활성화 시 호출되는 콜백 (서브클래스에서 구현)
   */
  protected onActivate(): void {
    // 서브클래스에서 구현
  }

  /**
   * 비활성화 시 호출되는 콜백 (서브클래스에서 구현)
   */
  protected onDeactivate(): void {
    // 서브클래스에서 구현
  }

  /**
   * 우회 시 호출되는 콜백 (서브클래스에서 구현)
   */
  protected onBypass(): void {
    // 서브클래스에서 구현
  }

  /**
   * 우회 해제 시 호출되는 콜백 (서브클래스에서 구현)
   */
  protected onUnbypass(): void {
    // 서브클래스에서 구현
  }
}

