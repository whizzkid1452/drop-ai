export interface ResourceCleanupResult {
  readonly isComplete: boolean;
  readonly failedResourceCount: number;
}

export const COMPLETE_RESOURCE_CLEANUP: ResourceCleanupResult = Object.freeze({
  isComplete: true,
  failedResourceCount: 0,
});
