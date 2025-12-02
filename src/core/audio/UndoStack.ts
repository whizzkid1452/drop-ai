/**
 * UndoStack - 실행 취소/다시 실행 스택 관리
 * Ardour의 Undo 시스템을 참고한 Command 패턴 구현
 */

/**
 * 실행 가능한 명령 인터페이스
 */
export interface Command {
  /** 명령 실행 */
  execute(): void;
  /** 명령 취소 (Undo) */
  undo(): void;
  /** 명령 설명 */
  description: string;
}

/**
 * Undo/Redo 스택 관리 클래스
 */
export class UndoStack {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxStackSize: number = 100;

  constructor(maxStackSize: number = 100) {
    this.maxStackSize = maxStackSize;
  }

  /**
   * 명령 실행 및 스택에 추가
   */
  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);

    // 스택 크기 제한
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }

    // 새 명령 실행 시 redo 스택 초기화
    this.redoStack = [];
  }

  /**
   * 실행 취소
   */
  undo(): boolean {
    if (this.undoStack.length === 0) {
      return false;
    }

    const command = this.undoStack.pop()!;
    command.undo();
    this.redoStack.push(command);

    return true;
  }

  /**
   * 다시 실행
   */
  redo(): boolean {
    if (this.redoStack.length === 0) {
      return false;
    }

    const command = this.redoStack.pop()!;
    command.execute();
    this.undoStack.push(command);

    return true;
  }

  /**
   * Undo 가능 여부
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Redo 가능 여부
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * 다음 Undo 명령 설명
   */
  getNextUndoDescription(): string | null {
    if (this.undoStack.length === 0) {
      return null;
    }
    return this.undoStack[this.undoStack.length - 1].description;
  }

  /**
   * 다음 Redo 명령 설명
   */
  getNextRedoDescription(): string | null {
    if (this.redoStack.length === 0) {
      return null;
    }
    return this.redoStack[this.redoStack.length - 1].description;
  }

  /**
   * 스택 초기화
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * 스택 크기 가져오기
   */
  getStackSize(): { undo: number; redo: number } {
    return {
      undo: this.undoStack.length,
      redo: this.redoStack.length,
    };
  }
}
