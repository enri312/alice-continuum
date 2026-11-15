export interface RerankReportRequest {
  schemaVersion: 1;
  rankings: Array<{ lexical: number[]; reranked: number[] }>;
  totalRerankLatencyMs: number;
  sourcePreserved: boolean;
}
export interface RerankReport {
  realConfirmedProfileRecords: number;
  lexicalTop1: number;
  lexicalTop3: number;
  gemmaRerankTop1: number;
  gemmaRerankTop3: number;
  totalRerankLatencyMs: number;
  meanRerankLatencyMs: number;
  sourcePreserved: boolean;
  indexPersisted: false;
}
export interface RerankReportOptions { pythonExecutable?: string; timeoutMs?: number }
export function resolveRerankPython(options?: RerankReportOptions): string;
export function createRerankReport(request: RerankReportRequest, options?: RerankReportOptions): RerankReport;
