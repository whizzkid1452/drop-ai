
/**
 * ControlSurface
 * 
 * 모든 하드웨어 컨트롤 서페이스가 구현해야 하는 기본 인터페이스입니다.
 * 장치의 연결/해제 및 초기화를 담당합니다.
 */
export interface ControlSurface {
    /** 장치 이름 (e.g. "Ableton Push 2") */
    readonly name: string;

    /** 장치 연결 (MIDI 포트 획득 등) */
    connect(): Promise<void>;

    /** 장치 해제 (리소스 정리) */
    disconnect(): void;

    /** 연결 상태 확인 */
    isConnected(): boolean;
}
