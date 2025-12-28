/**
 * WebGPU 지원 확인 유틸리티
 */

export interface WebGPUCheckResult {
  supported: boolean;
  error?: string;
  info?: {
    adapter: string;
    features: string[];
  };
}

/**
 * 브라우저의 WebGPU 지원 여부를 확인합니다.
 * WebLLM 사용을 위해 필수적입니다.
 */
export async function checkWebGPUSupport(): Promise<WebGPUCheckResult> {
  // WebGPU API 존재 여부 확인
  if (!navigator.gpu) {
    return {
      supported: false,
      error: "WebGPU를 지원하지 않는 브라우저입니다. Chrome 113 이상을 사용해주세요.",
    };
  }

  try {
    // GPU 어댑터 요청
    const adapter = await navigator.gpu.requestAdapter();
    
    if (!adapter) {
      return {
        supported: false,
        error: "GPU 어댑터를 찾을 수 없습니다. 그래픽 드라이버를 업데이트해주세요.",
      };
    }

    // 어댑터 정보 수집
    const features = Array.from(adapter.features) as string[];
    const info = adapter.info || { vendor: "Unknown", architecture: "Unknown" };

    return {
      supported: true,
      info: {
        adapter: `${info.vendor} ${info.architecture}`,
        features,
      },
    };
  } catch (error) {
    return {
      supported: false,
      error: error instanceof Error ? error.message : "WebGPU 초기화 중 오류가 발생했습니다.",
    };
  }
}

/**
 * SharedArrayBuffer 지원 여부를 확인합니다.
 * Cross-Origin Isolation이 필요합니다.
 */
export function checkSharedArrayBufferSupport(): boolean {
  return typeof SharedArrayBuffer !== "undefined";
}

/**
 * Cross-Origin Isolation 상태를 확인합니다.
 */
export function checkCrossOriginIsolation(): boolean {
  return window.crossOriginIsolated === true;
}

/**
 * WebLLM 실행을 위한 모든 요구사항을 확인합니다.
 */
export async function checkWebLLMRequirements(): Promise<{
  webgpu: WebGPUCheckResult;
  sharedArrayBuffer: boolean;
  crossOriginIsolated: boolean;
  allSupported: boolean;
}> {
  const webgpu = await checkWebGPUSupport();
  const sharedArrayBuffer = checkSharedArrayBufferSupport();
  const crossOriginIsolated = checkCrossOriginIsolation();

  return {
    webgpu,
    sharedArrayBuffer,
    crossOriginIsolated,
    allSupported: webgpu.supported && sharedArrayBuffer && crossOriginIsolated,
  };
}

