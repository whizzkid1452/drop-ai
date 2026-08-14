export const RUNTIME_DIAGNOSTIC_BUDGETS = {
  criticalStorageUsageRatio: 0.95,
  diagnosticsRefreshIntervalMilliseconds: 5_000,
  maximumPendingCleanupResources: 0,
  maximumPcmCaptureBytes: 256 * 1_024 * 1_024,
  maximumWaveformCacheEntries: 128,
  meterRefreshIntervalMilliseconds: 50,
  warningStorageUsageRatio: 0.8,
} as const;

export type RuntimeAudioContextState = 'closed' | 'interrupted' | 'running' | 'suspended' | 'unavailable';
export type RuntimeStorageStatus = 'available' | 'critical' | 'unavailable' | 'warning';
export type RuntimeVisibilityState = 'hidden' | 'prerender' | 'unknown' | 'visible';

export interface AudioEngineRuntimeHealth {
  readonly audioContextState: RuntimeAudioContextState;
  readonly pendingCleanupResourceCount: number;
}

export interface RuntimeStorageHealth {
  readonly quotaBytes: number | null;
  readonly status: RuntimeStorageStatus;
  readonly usageBytes: number | null;
  readonly usageRatio: number | null;
}

export interface RuntimeDiagnosticsState extends AudioEngineRuntimeHealth {
  readonly checkedAt: string | null;
  readonly storage: RuntimeStorageHealth;
  readonly visibilityState: RuntimeVisibilityState;
}

export function classifyStorageHealth({
  quotaBytes,
  usageBytes,
}: {
  readonly quotaBytes?: number;
  readonly usageBytes?: number;
}): RuntimeStorageHealth {
  if (
    !Number.isFinite(quotaBytes) ||
    !Number.isFinite(usageBytes) ||
    !quotaBytes ||
    quotaBytes <= 0 ||
    usageBytes === undefined
  ) {
    return { quotaBytes: null, status: 'unavailable', usageBytes: null, usageRatio: null };
  }
  const usageRatio = Math.max(0, usageBytes / quotaBytes);
  const status =
    usageRatio >= RUNTIME_DIAGNOSTIC_BUDGETS.criticalStorageUsageRatio
      ? 'critical'
      : usageRatio >= RUNTIME_DIAGNOSTIC_BUDGETS.warningStorageUsageRatio
        ? 'warning'
        : 'available';
  return { quotaBytes, status, usageBytes, usageRatio };
}
