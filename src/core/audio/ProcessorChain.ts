/**
 * ProcessorChain - 프로세서 체인 관리 클래스
 * Ardour의 Processor Chain 개념을 참고하여 구현
 * 
 * ProcessorChain은 Route의 오디오 처리 체인을 관리합니다.
 * Pre-Fader와 Post-Fader로 구분하여 프로세서를 관리하며,
 * Send/Return 처리와 레이턴시 계산을 지원합니다.
 * 
 * 주요 기능:
 * - Pre-Fader/Post-Fader 프로세서 구분 관리
 * - Processor 추가/제거/재정렬
 * - Send/Return 처리
 * - 레이턴시 계산 및 보상
 * - 바이패스 지원
 * - AudioNode 연결 관리
 */

import { Processor } from './Processor';
import { ProcessorPlacement } from './Route';

/**
 * ProcessorChain 노드 - 프로세서와 메타데이터를 함께 저장
 */
export interface ProcessorChainNode {
  processor: Processor;
  placement: ProcessorPlacement;
  index: number; // Pre-Fader 또는 Post-Fader 내에서의 인덱스
}

/**
 * ProcessorChain 구성 요소
 */
export interface ProcessorChainStructure {
  preFader: ProcessorChainNode[];
  postFader: ProcessorChainNode[];
  sends: ProcessorChainNode[]; // Send 프로세서 (Pre-Fader 또는 Post-Fader에서 분기)
  returns: ProcessorChainNode[]; // Return 프로세서 (외부에서 입력)
}

/**
 * 레이턴시 정보
 */
export interface LatencyInfo {
  inputLatency: number; // 샘플 단위
  outputLatency: number; // 샘플 단위
  totalLatency: number; // 샘플 단위
}

/**
 * ProcessorChain - 프로세서 체인 관리 클래스
 */
export class ProcessorChain {
  private preFaderProcessors: ProcessorChainNode[] = [];
  private postFaderProcessors: ProcessorChainNode[] = [];
  private sendProcessors: ProcessorChainNode[] = [];
  private returnProcessors: ProcessorChainNode[] = [];
  
  // 입력/출력 노드
  private inputNode: AudioNode | null = null;
  private outputNode: AudioNode | null = null;
  private faderNode: GainNode | null = null; // Fader 위치 (Pre-Fader와 Post-Fader 사이)
  
  // 레이턴시 정보
  private latencyInfo: LatencyInfo = {
    inputLatency: 0,
    outputLatency: 0,
    totalLatency: 0,
  };
  
  // 락 (동시 접근 방지)
  private isLocked: boolean = false;
  
  constructor(_context: AudioContext) {
    // context는 향후 확장을 위해 유지 (현재는 사용하지 않음)
  }
  
  /**
   * 입력 노드 설정
   */
  setInputNode(node: AudioNode): void {
    this.inputNode = node;
    this.rebuildChain();
  }
  
  /**
   * 출력 노드 설정
   */
  setOutputNode(node: AudioNode): void {
    this.outputNode = node;
    this.rebuildChain();
  }
  
  /**
   * Fader 노드 설정 (Pre-Fader와 Post-Fader 사이)
   */
  setFaderNode(node: GainNode): void {
    this.faderNode = node;
    this.rebuildChain();
  }
  
  /**
   * 프로세서 추가
   * @param processor 추가할 프로세서
   * @param placement 배치 위치
   * @param index 특정 위치에 삽입 (선택적, 기본값: 끝에 추가)
   * @returns 성공 여부
   */
  addProcessor(
    processor: Processor,
    placement: ProcessorPlacement,
    index?: number
  ): boolean {
    if (this.isLocked) {
      console.warn('ProcessorChain is locked');
      return false;
    }
    
    try {
      this.isLocked = true;
      
      // 프로세서 활성화
      processor.activate();
      
      // 배치 위치에 따라 적절한 리스트에 추가
      const node: ProcessorChainNode = {
        processor,
        placement,
        index: 0, // 임시 값, 실제 인덱스는 추가 후 설정
      };
      
      let targetList: ProcessorChainNode[];
      switch (placement) {
        case ProcessorPlacement.PreInput:
        case ProcessorPlacement.PreFader:
          targetList = this.preFaderProcessors;
          break;
        case ProcessorPlacement.PostFader:
        case ProcessorPlacement.PostOutput:
          targetList = this.postFaderProcessors;
          break;
        default:
          targetList = this.preFaderProcessors;
      }
      
      // 인덱스 설정
      if (index !== undefined && index >= 0 && index <= targetList.length) {
        targetList.splice(index, 0, node);
      } else {
        targetList.push(node);
      }
      
      // 인덱스 재계산
      this.recalculateIndices();
      
      // 체인 재구성
      this.rebuildChain();
      
      // 레이턴시 재계산
      this.recalculateLatency();
      
      return true;
    } catch (error) {
      console.error('Failed to add processor:', error);
      return false;
    } finally {
      this.isLocked = false;
    }
  }
  
  /**
   * 프로세서 제거
   * @param processor 제거할 프로세서
   * @returns 성공 여부
   */
  removeProcessor(processor: Processor): boolean {
    if (this.isLocked) {
      console.warn('ProcessorChain is locked');
      return false;
    }
    
    try {
      this.isLocked = true;
      
      // 모든 리스트에서 찾아서 제거
      const lists = [
        this.preFaderProcessors,
        this.postFaderProcessors,
        this.sendProcessors,
        this.returnProcessors,
      ];
      
      let removed = false;
      for (const list of lists) {
        const index = list.findIndex(node => node.processor === processor);
        if (index !== -1) {
          list[index].processor.disconnect();
          list[index].processor.deactivate();
          list.splice(index, 1);
          removed = true;
          break;
        }
      }
      
      if (!removed) {
        return false;
      }
      
      // 인덱스 재계산
      this.recalculateIndices();
      
      // 체인 재구성
      this.rebuildChain();
      
      // 레이턴시 재계산
      this.recalculateLatency();
      
      return true;
    } catch (error) {
      console.error('Failed to remove processor:', error);
      return false;
    } finally {
      this.isLocked = false;
    }
  }
  
  /**
   * 프로세서 재정렬
   * @param processors 새로운 순서 (Pre-Fader 또는 Post-Fader 중 하나)
   * @param placement Pre-Fader 또는 Post-Fader
   * @returns 성공 여부
   */
  reorderProcessors(
    processors: Processor[],
    placement: ProcessorPlacement
  ): boolean {
    if (this.isLocked) {
      console.warn('ProcessorChain is locked');
      return false;
    }
    
    try {
      this.isLocked = true;
      
      const isPreFader =
        placement === ProcessorPlacement.PreInput ||
        placement === ProcessorPlacement.PreFader;
      
      const targetList = isPreFader
        ? this.preFaderProcessors
        : this.postFaderProcessors;
      
      // 모든 프로세서가 현재 리스트에 있는지 확인
      const currentProcessors = targetList.map(node => node.processor);
      const allExist = processors.every(proc =>
        currentProcessors.includes(proc)
      );
      
      if (!allExist || processors.length !== currentProcessors.length) {
        return false;
      }
      
      // 새로운 순서로 재구성
      const newList: ProcessorChainNode[] = processors.map((proc, idx) => {
        const existingNode = targetList.find(node => node.processor === proc);
        if (!existingNode) {
          throw new Error('Processor not found');
        }
        return {
          ...existingNode,
          index: idx,
        };
      });
      
      // 리스트 교체
      if (isPreFader) {
        this.preFaderProcessors = newList;
      } else {
        this.postFaderProcessors = newList;
      }
      
      // 체인 재구성
      this.rebuildChain();
      
      return true;
    } catch (error) {
      console.error('Failed to reorder processors:', error);
      return false;
    } finally {
      this.isLocked = false;
    }
  }
  
  /**
   * 프로세서 이동 (Pre-Fader ↔ Post-Fader)
   * @param processor 이동할 프로세서
   * @param newPlacement 새로운 배치 위치
   * @param index 새로운 위치의 인덱스 (선택적)
   * @returns 성공 여부
   */
  moveProcessor(
    processor: Processor,
    newPlacement: ProcessorPlacement,
    index?: number
  ): boolean {
    if (this.isLocked) {
      console.warn('ProcessorChain is locked');
      return false;
    }
    
    // 먼저 제거
    if (!this.removeProcessor(processor)) {
      return false;
    }
    
    // 새로운 위치에 추가
    return this.addProcessor(processor, newPlacement, index);
  }
  
  /**
   * 모든 프로세서 가져오기
   */
  getAllProcessors(): Processor[] {
    const allNodes = [
      ...this.preFaderProcessors,
      ...this.postFaderProcessors,
      ...this.sendProcessors,
      ...this.returnProcessors,
    ];
    return allNodes.map(node => node.processor);
  }
  
  /**
   * Pre-Fader 프로세서 가져오기
   */
  getPreFaderProcessors(): Processor[] {
    return this.preFaderProcessors.map(node => node.processor);
  }
  
  /**
   * Post-Fader 프로세서 가져오기
   */
  getPostFaderProcessors(): Processor[] {
    return this.postFaderProcessors.map(node => node.processor);
  }
  
  /**
   * Send 프로세서 가져오기
   */
  getSendProcessors(): Processor[] {
    return this.sendProcessors.map(node => node.processor);
  }
  
  /**
   * Return 프로세서 가져오기
   */
  getReturnProcessors(): Processor[] {
    return this.returnProcessors.map(node => node.processor);
  }
  
  /**
   * 프로세서 체인 구조 가져오기
   */
  getStructure(): ProcessorChainStructure {
    return {
      preFader: [...this.preFaderProcessors],
      postFader: [...this.postFaderProcessors],
      sends: [...this.sendProcessors],
      returns: [...this.returnProcessors],
    };
  }
  
  /**
   * 레이턴시 정보 가져오기
   */
  getLatencyInfo(): Readonly<LatencyInfo> {
    return { ...this.latencyInfo };
  }
  
  /**
   * 프로세서 개수 가져오기
   */
  getProcessorCount(): number {
    return (
      this.preFaderProcessors.length +
      this.postFaderProcessors.length +
      this.sendProcessors.length +
      this.returnProcessors.length
    );
  }
  
  /**
   * 인덱스 재계산
   */
  private recalculateIndices(): void {
    this.preFaderProcessors.forEach((node, idx) => {
      node.index = idx;
    });
    this.postFaderProcessors.forEach((node, idx) => {
      node.index = idx;
    });
    this.sendProcessors.forEach((node, idx) => {
      node.index = idx;
    });
    this.returnProcessors.forEach((node, idx) => {
      node.index = idx;
    });
  }
  
  /**
   * 프로세서 체인 재구성 (AudioNode 연결)
   */
  private rebuildChain(): void {
    if (!this.inputNode || !this.outputNode) {
      // 입력/출력 노드가 설정되지 않았으면 연결하지 않음
      return;
    }
    
    // 모든 기존 연결 해제
    this.disconnectAll();
    
    // Pre-Fader 체인 구성
    let currentNode: AudioNode = this.inputNode;
    
    for (const node of this.preFaderProcessors) {
      const processor = node.processor;
      const inputNode = processor.getInputNode();
      const outputNode = processor.getOutputNode();
      
      if (!inputNode || !outputNode) {
        console.warn(`Processor ${processor.getName()} missing input/output nodes`);
        continue;
      }
      
      // 현재 노드 → 프로세서 입력
      currentNode.disconnect();
      currentNode.connect(inputNode);
      
      // 프로세서 출력 → 다음 노드
      currentNode = outputNode;
    }
    
    // Fader 노드 연결 (Pre-Fader → Fader)
    if (this.faderNode) {
      currentNode.disconnect();
      currentNode.connect(this.faderNode);
      currentNode = this.faderNode;
    }
    
    // Post-Fader 체인 구성
    for (const node of this.postFaderProcessors) {
      const processor = node.processor;
      const inputNode = processor.getInputNode();
      const outputNode = processor.getOutputNode();
      
      if (!inputNode || !outputNode) {
        console.warn(`Processor ${processor.getName()} missing input/output nodes`);
        continue;
      }
      
      // 현재 노드 → 프로세서 입력
      currentNode.disconnect();
      currentNode.connect(inputNode);
      
      // 프로세서 출력 → 다음 노드
      currentNode = outputNode;
    }
    
    // 최종 출력 노드 연결
    currentNode.disconnect();
    currentNode.connect(this.outputNode);
    
    // Send 프로세서는 별도로 처리 (분기)
    // Send는 Pre-Fader 또는 Post-Fader에서 분기되어 외부로 전송
    // 이 부분은 Route에서 Send를 추가할 때 별도로 처리해야 함
    
    // Return 프로세서는 별도로 처리 (외부 입력)
    // Return은 외부에서 입력을 받아 Post-Fader 체인에 합류
    // 이 부분도 Route에서 Return을 추가할 때 별도로 처리해야 함
  }
  
  /**
   * 모든 연결 해제
   */
  private disconnectAll(): void {
    // 모든 프로세서 연결 해제
    this.getAllProcessors().forEach(processor => {
      processor.disconnect();
    });
  }
  
  /**
   * 레이턴시 재계산
   */
  private recalculateLatency(): void {
    let inputLatency = 0;
    let outputLatency = 0;
    
    // Pre-Fader 프로세서 레이턴시
    for (const node of this.preFaderProcessors) {
      const processor = node.processor;
      if (processor.isActive() && !processor.isBypassed()) {
        // Processor 인터페이스에 레이턴시 메서드가 있다고 가정
        // 실제로는 Processor 서브클래스에서 구현해야 함
        // inputLatency += processor.getInputLatency?.() || 0;
        // outputLatency += processor.getOutputLatency?.() || 0;
      }
    }
    
    // Post-Fader 프로세서 레이턴시
    for (const node of this.postFaderProcessors) {
      const processor = node.processor;
      if (processor.isActive() && !processor.isBypassed()) {
        // outputLatency += processor.getOutputLatency?.() || 0;
      }
    }
    
    this.latencyInfo = {
      inputLatency,
      outputLatency,
      totalLatency: inputLatency + outputLatency,
    };
  }
  
  /**
   * Send 프로세서 추가
   * @param processor Send 프로세서
   * @param fromPreFader Pre-Fader에서 분기할지 여부
   * @returns 성공 여부
   */
  addSend(processor: Processor, fromPreFader: boolean = false): boolean {
    const placement = fromPreFader
      ? ProcessorPlacement.PreFader
      : ProcessorPlacement.PostFader;
    
    const node: ProcessorChainNode = {
      processor,
      placement,
      index: this.sendProcessors.length,
    };
    
    this.sendProcessors.push(node);
    processor.activate();
    
    // Send는 분기이므로 체인 재구성 시 별도 처리 필요
    // 실제 연결은 Route에서 처리해야 함
    
    return true;
  }
  
  /**
   * Return 프로세서 추가
   * @param processor Return 프로세서
   * @returns 성공 여부
   */
  addReturn(processor: Processor): boolean {
    const node: ProcessorChainNode = {
      processor,
      placement: ProcessorPlacement.PostFader,
      index: this.returnProcessors.length,
    };
    
    this.returnProcessors.push(node);
    processor.activate();
    
    // Return은 외부 입력이므로 체인 재구성 시 별도 처리 필요
    // 실제 연결은 Route에서 처리해야 함
    
    return true;
  }
  
  /**
   * 리소스 정리
   */
  dispose(): void {
    this.isLocked = true;
    
    // 모든 프로세서 정리
    this.getAllProcessors().forEach(processor => {
      processor.dispose();
    });
    
    // 리스트 초기화
    this.preFaderProcessors = [];
    this.postFaderProcessors = [];
    this.sendProcessors = [];
    this.returnProcessors = [];
    
    // 연결 해제
    this.disconnectAll();
    
    this.inputNode = null;
    this.outputNode = null;
    this.faderNode = null;
    
    this.isLocked = false;
  }
}


