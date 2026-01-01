/**
 * WebGPU 하드웨어 정보를 가져오는 함수
 * @returns 하드웨어 정보 문자열
 */
export async function getHardwareInfo(): Promise<string> {
    try {
        if ('gpu' in navigator) {
            const adapter = await (navigator as any).gpu.requestAdapter();
            if (adapter) {
                const info = await adapter.requestAdapterInfo();
                return `${info.vendor} - ${info.device}`;
            } else {
                return "WebGPU Adapter not found.";
            }
        } else {
            return "WebGPU not supported by browser.";
        }
    } catch (e: any) {
        return `GPU Query Error: ${e.message}`;
    }
}

