/**
 * WebGPU Navigator 인터페이스 확장
 */
interface GPUAdapterInfo {
  vendor: string;
  device: string;
}

interface GPUAdapter {
  requestAdapterInfo(): Promise<GPUAdapterInfo>;
}

interface NavigatorWithGPU extends Navigator {
  gpu?: {
    requestAdapter(): Promise<GPUAdapter | null>;
  };
}

/**
 * WebGPU 하드웨어 정보를 가져오는 함수
 * @returns 하드웨어 정보 문자열
 */
export async function getHardwareInfo(): Promise<string> {
  try {
    const navigatorWithGPU = navigator as NavigatorWithGPU;
    if ('gpu' in navigatorWithGPU && navigatorWithGPU.gpu) {
      const adapter = await navigatorWithGPU.gpu.requestAdapter();
      if (adapter) {
        const info = await adapter.requestAdapterInfo();
        return `${info.vendor} - ${info.device}`;
      } else {
        return 'WebGPU Adapter not found.';
      }
    } else {
      return 'WebGPU not supported by browser.';
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return `GPU Query Error: ${errorMessage}`;
  }
}
