/**
 * WebGPU 지원 확인 유틸리티
 */

export interface WebGPUSupport {
  supported: boolean;
  message: string;
  details?: {
    adapter?: GPUAdapter;
    device?: GPUDevice;
  };
}

/**
 * WebGPU 지원 여부를 확인합니다
 */
export async function checkWebGPUSupport(): Promise<WebGPUSupport> {
  // WebGPU API 존재 여부 확인
  if (!navigator.gpu) {
    return {
      supported: false,
      message: 'WebGPU가 지원되지 않습니다. Chrome 113 이상이 필요합니다.',
    };
  }

  try {
    // 어댑터 요청
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        message: 'GPU 어댑터를 찾을 수 없습니다.',
      };
    }

    // 디바이스 요청
    const device = await adapter.requestDevice();

    return {
      supported: true,
      message: 'WebGPU가 지원됩니다.',
      details: {
        adapter,
        device,
      },
    };
  } catch (error) {
    return {
      supported: false,
      message: `WebGPU 초기화 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * WebGPU 지원 여부를 간단히 확인합니다 (동기)
 */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

