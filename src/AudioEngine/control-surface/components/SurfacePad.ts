
/**
 * SurfacePad
 * 
 * 컨트롤 서페이스의 '패드(Pad)' 컴포넌트를 정의하는 인터페이스입니다.
 * Note On/Off 이벤트를 처리합니다.
 */
export interface SurfacePad {
    /** 패드 색상 변경 */
    setColor(color: number): void;

    /** 패드 깜빡임 효과 */
    pulse(color: number, duration?: number): void;
}
