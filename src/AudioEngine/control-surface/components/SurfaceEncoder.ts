
export interface SurfaceEncoder {
    /** 값 변경 (0 ~ 127) */
    setValue(value: number): void;

    /** 회전 (상대값) */
    turn(delta: number): void;
}
