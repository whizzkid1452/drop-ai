export const TRACK_STATUS = {
  MUTED: 'MUTED',
  SOLOED: 'SOLOED',
  RECORD_ARMED: 'RECORD_ARMED', // Future proofing
} as const;

export type TrackStatus = (typeof TRACK_STATUS)[keyof typeof TRACK_STATUS];

export const REGION_STATUS = {
  SELECTED: 'SELECTED',
  DRAGGING: 'DRAGGING', // If we want to track dragging state in domain, though typically this is UI state. But if it affects logic (e.g. bypass processing), it serves.
} as const;

export type RegionStatus = (typeof REGION_STATUS)[keyof typeof REGION_STATUS];
