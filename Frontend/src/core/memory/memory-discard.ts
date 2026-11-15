export type LegacyMemoryDiscardState = {
  memoryStatus?: unknown;
  memoryVersion?: unknown;
  archiveStatus?: unknown;
  deletionStatus?: unknown;
};

export function isLegacyMemoryDiscardable(memory: LegacyMemoryDiscardState | null | undefined) {
  return Boolean(memory)
    && memory?.memoryStatus == null
    && memory?.memoryVersion == null
    && memory?.archiveStatus == null
    && memory?.deletionStatus == null;
}
