interface GPUAdapterInfoLike {
  readonly device: string;
  readonly vendor: string;
}

interface GPUAdapterLike {
  readonly info: GPUAdapterInfoLike;
}

interface GPULike {
  requestAdapter(): Promise<GPUAdapterLike | null>;
}

interface NavigatorWithGPU extends Navigator {
  readonly gpu?: GPULike;
}

/**
 * WebGPU 하드웨어 정보를 가져오는 함수
 * @returns 하드웨어 정보 문자열
 */
export async function getHardwareInfo(): Promise<string> {
  try {
    const gpu = (navigator as NavigatorWithGPU).gpu;
    if (!gpu) {
      return 'WebGPU not supported by browser.';
    }

    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return 'WebGPU Adapter not found.';
    }

    return `${adapter.info.vendor} - ${adapter.info.device}`;
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return `GPU Query Error: ${errorMessage}`;
  }
}
