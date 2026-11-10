export interface ObsidianSyncOptions {
  projectRoot: string;
  dataRoot?: string;
}

export interface ObsidianSyncResult {
  vaultPath: string;
  memoryPath: string;
  confirmedCount: number;
  automaticCount: number;
  profileCount: number;
  studyCount: number;
  legacyNoteCount: number;
  changed: boolean;
}

export function syncObsidianVault(options: ObsidianSyncOptions): Promise<ObsidianSyncResult>;
export function startObsidianSync(options: ObsidianSyncOptions): { close(): Promise<void> };
