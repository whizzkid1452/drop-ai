import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHardwareInfo } from './hardwareInfo';

describe('getHardwareInfo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GPUAdapter.info의 제조사와 장치 이름을 반환한다', async () => {
    vi.stubGlobal('navigator', {
      gpu: {
        requestAdapter: vi.fn().mockResolvedValue({
          info: {
            vendor: 'Vendor',
            device: 'Device',
          },
        }),
      },
    });

    await expect(getHardwareInfo()).resolves.toBe('Vendor - Device');
  });

  it('WebGPU가 없으면 지원하지 않는다는 결과를 반환한다', async () => {
    vi.stubGlobal('navigator', {});

    await expect(getHardwareInfo()).resolves.toBe('WebGPU not supported by browser.');
  });

  it('GPU Adapter를 찾지 못하면 명확한 결과를 반환한다', async () => {
    vi.stubGlobal('navigator', {
      gpu: {
        requestAdapter: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(getHardwareInfo()).resolves.toBe('WebGPU Adapter not found.');
  });

  it('GPU 조회 오류 메시지를 반환한다', async () => {
    vi.stubGlobal('navigator', {
      gpu: {
        requestAdapter: vi.fn().mockRejectedValue(new Error('blocked')),
      },
    });

    await expect(getHardwareInfo()).resolves.toBe('GPU Query Error: blocked');
  });
});
