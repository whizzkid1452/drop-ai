/**
 * Route - Track과 Bus의 공통 베이스 클래스
 * Ardour의 Route 클래스를 참고하여 구현
 * 
 * Route는 DAW에서 믹싱 가능한 모든 오디오 경로를 나타냅니다.
 * Track과 Bus 모두 Route를 상속받아 공통 기능을 공유합니다.
 * 
 * 주요 기능:
 * - 프로세서 체인 관리 (add/remove/reorder)
 * - Gain/Pan 제어
 * - Solo/Mute 제어
 * - IO 관리
 */

import { Processor } from './Processor';
import { ProcessorChain } from './ProcessorChain';
// Web Audio API 타입은 브라우저 내장이므로 별도 import 불필요

/**
 * 프로세서 배치 위치 (Ardour의 Placement 개념)
 */
export enum ProcessorPlacement {
  PreFader = 'pre-fader',
  PostFader = 'post-fader',
  PreInput = 'pre-input',
  PostOutput = 'post-output',
}

/**
 * 프로세서 추가/제거 결과
 */
export interface ProcessorOperationResult {
  success: boolean;
  error?: string;
  processor?: Processor;
}

/**
 * Route 베이스 클래스
 */
export abstract class Route {
  protected name: string;
  protected context: AudioContext;
  protected processorChain: ProcessorChain;
  protected processors: Processor[] = []; // 레거시 호환성 (deprecated, processorChain 사용 권장)
  protected inputSumNode: GainNode; // 입력 합산 노드 (여러 소스 합산)
  protected gainNode: GainNode;
  protected panNode: StereoPannerNode | null = null;
  protected isMuted: boolean = false;
  protected isSolo: boolean = false;
  protected volume: number = 100; // 0-100
  protected pan: number = 0; // -100 ~ 100
  protected isActive: boolean = true;
  protected color: string = '#4a90e2';

  // 프로세서 체인 순서 관리
  private processorLock: boolean = false; // 간단한 락 (실제로는 더 정교한 락 필요)

  constructor(context: AudioContext, name: string) {
    this.context = context;
    this.name = name;
    
    // ProcessorChain 생성
    this.processorChain = new ProcessorChain(context);
    
    // 입력 합산 노드 생성 (여러 소스 합산용)
    this.inputSumNode = context.createGain();
    this.inputSumNode.gain.value = 1.0;
    
    // ProcessorChain에 입력 노드 설정
    this.processorChain.setInputNode(this.inputSumNode);
    
    // Gain 노드 생성
    this.gainNode = context.createGain();
    this.gainNode.gain.value = this.volume / 100;

    // Pan 노드 생성 (스테레오)
    this.panNode = context.createStereoPanner();
    if (this.panNode) {
      this.panNode.pan.value = 0;

      // ProcessorChain에 Fader 노드 설정 (Gain = Fader)
      this.processorChain.setFaderNode(this.gainNode);
      // ProcessorChain에 출력 노드 설정 (Gain = ProcessorChain 출력)
      // ProcessorChain 출력 -> Gain -> Pan -> 최종 출력
      this.processorChain.setOutputNode(this.gainNode);
      
      // Gain -> Pan 연결
      this.gainNode.connect(this.panNode);
    }
  }

  /**
   * 이름 가져오기
   */
  getName(): string {
    return this.name;
  }

  /**
   * 이름 설정
   */
  setName(name: string): void {
    this.name = name;
  }

  /**
   * 색상 가져오기
   */
  getColor(): string {
    return this.color;
  }

  /**
   * 색상 설정
   */
  setColor(color: string): void {
    this.color = color;
  }

  /**
   * 활성 상태 가져오기
   */
  isRouteActive(): boolean {
    return this.isActive;
  }

  /**
   * 활성 상태 설정
   */
  setActive(active: boolean): void {
    this.isActive = active;
    this.applyGain();
  }

  /**
   * 볼륨 설정 (0-100)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume));
    this.applyGain();
  }

  /**
   * 볼륨 가져오기
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Pan 설정 (-100 ~ 100)
   */
  setPan(pan: number): void {
    this.pan = Math.max(-100, Math.min(100, pan));
    if (this.panNode) {
      this.panNode.pan.value = this.pan / 100;
    }
  }

  /**
   * Pan 가져오기
   */
  getPan(): number {
    return this.pan;
  }

  /**
   * Mute 설정
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.applyGain();
  }

  /**
   * Mute 여부 확인
   */
  isMutedState(): boolean {
    return this.isMuted;
  }

  /**
   * Solo 설정
   */
  setSolo(solo: boolean): void {
    this.isSolo = solo;
    // Note: 실제 Solo 로직은 Session에서 처리
  }

  /**
   * Solo 여부 확인
   */
  isSoloState(): boolean {
    return this.isSolo;
  }

  /**
   * 현재 상태에 따른 실제 게인 적용
   */
  protected applyGain(): void {
    const shouldMute = this.isMuted || !this.isActive;
    this.gainNode.gain.value = shouldMute ? 0 : this.volume / 100;
  }

  /**
   * 프로세서 추가
   * @param processor 추가할 프로세서
   * @param placement 배치 위치
   * @returns 작업 결과
   */
  addProcessor(
    processor: Processor,
    placement: ProcessorPlacement = ProcessorPlacement.PreFader
  ): ProcessorOperationResult {
    if (this.processorLock) {
      return { success: false, error: 'Processor chain is locked' };
    }

    try {
      this.processorLock = true;

      // ProcessorChain에 추가
      const success = this.processorChain.addProcessor(processor, placement);
      
      if (!success) {
        return { success: false, error: 'Failed to add processor to chain' };
      }

      // 레거시 호환성: processors 배열에도 추가
      this.processors.push(processor);

      return { success: true, processor };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.processorLock = false;
    }
  }

  /**
   * 프로세서 제거
   * @param processor 제거할 프로세서
   * @returns 작업 결과
   */
  removeProcessor(processor: Processor): ProcessorOperationResult {
    if (this.processorLock) {
      return { success: false, error: 'Processor chain is locked' };
    }

    try {
      this.processorLock = true;

      // ProcessorChain에서 제거
      const success = this.processorChain.removeProcessor(processor);
      
      if (!success) {
        return { success: false, error: 'Processor not found in chain' };
      }

      // 레거시 호환성: processors 배열에서도 제거
      const index = this.processors.indexOf(processor);
      if (index !== -1) {
        this.processors.splice(index, 1);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.processorLock = false;
    }
  }

  /**
   * 프로세서 재정렬
   * @param newOrder 새로운 프로세서 순서
   * @param placement Pre-Fader 또는 Post-Fader (기본값: PreFader)
   * @returns 작업 결과
   */
  reorderProcessors(
    newOrder: Processor[],
    placement: ProcessorPlacement = ProcessorPlacement.PreFader
  ): ProcessorOperationResult {
    if (this.processorLock) {
      return { success: false, error: 'Processor chain is locked' };
    }

    try {
      this.processorLock = true;

      // ProcessorChain에서 재정렬
      const success = this.processorChain.reorderProcessors(newOrder, placement);
      
      if (!success) {
        return {
          success: false,
          error: 'Failed to reorder processors in chain',
        };
      }

      // 레거시 호환성: processors 배열도 업데이트
      // 주의: 이는 Pre-Fader와 Post-Fader를 구분하지 않으므로 제한적
      const allProcessors = this.processorChain.getAllProcessors();
      this.processors = allProcessors;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.processorLock = false;
    }
  }

  /**
   * 모든 프로세서 가져오기
   */
  getProcessors(): ReadonlyArray<Processor> {
    // ProcessorChain에서 가져오기 (권장)
    return this.processorChain.getAllProcessors();
  }
  
  /**
   * Pre-Fader 프로세서 가져오기
   */
  getPreFaderProcessors(): ReadonlyArray<Processor> {
    return this.processorChain.getPreFaderProcessors();
  }
  
  /**
   * Post-Fader 프로세서 가져오기
   */
  getPostFaderProcessors(): ReadonlyArray<Processor> {
    return this.processorChain.getPostFaderProcessors();
  }
  
  /**
   * ProcessorChain 가져오기
   */
  getProcessorChain(): ProcessorChain {
    return this.processorChain;
  }

  /**
   * 프로세서 인덱스로 가져오기
   */
  getProcessor(index: number): Processor | null {
    return this.processors[index] || null;
  }

  /**
   * 프로세서 개수 가져오기
   */
  getProcessorCount(): number {
    return this.processorChain.getProcessorCount();
  }

  /**
   * Route의 입력 노드 가져오기 (Clip 등이 연결할 노드)
   * 이 노드는 ProcessorChain의 입력으로 연결되어 있음
   */
  getInputNode(): GainNode {
    return this.inputSumNode;
  }

  /**
   * Route의 입력 노드를 ProcessorChain에 설정
   * @deprecated getInputNode()를 사용하여 입력 노드에 직접 연결하세요
   */
  protected setChainInputNode(inputNode: AudioNode): void {
    this.processorChain.setInputNode(inputNode);
  }

  /**
   * GainNode 가져오기 (내부 연결용)
   */
  getGainNode(): GainNode {
    return this.gainNode;
  }

  /**
   * AudioNode에 연결 (출력)
   * @param destination 연결할 대상 노드
   */
  connect(destination: AudioNode): void {
    // Pan 노드가 있으면 Pan -> destination
    // 없으면 Gain -> destination
    this.gainNode.disconnect();
    this.panNode?.disconnect();
    
    if (this.panNode) {
      this.gainNode.connect(this.panNode);
      this.panNode.connect(destination);
    } else {
      this.gainNode.connect(destination);
    }
    
    // ProcessorChain의 출력 노드도 업데이트
    // 주의: Pan 노드가 최종 출력이므로 ProcessorChain의 출력은 Pan 노드
    if (this.panNode) {
      this.processorChain.setOutputNode(this.panNode);
    } else {
      this.processorChain.setOutputNode(this.gainNode);
    }
  }

  /**
   * 연결 해제
   */
  disconnect(): void {
    this.gainNode.disconnect();
    this.panNode?.disconnect();
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    // ProcessorChain 정리
    this.processorChain.dispose();
    
    // 레거시 호환성: processors 배열도 정리
    this.processors = [];

    // 노드 연결 해제
    this.disconnect();
    this.inputSumNode.disconnect();
  }

  /**
   * Track인지 확인 (서브클래스에서 구현)
   */
  abstract isTrack(): boolean;

  /**
   * Bus인지 확인 (서브클래스에서 구현)
   */
  abstract isBus(): boolean;
}

