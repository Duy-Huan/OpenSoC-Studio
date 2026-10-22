// Design-only message boundary. These declarations do not provide a viewer.
export type EvidenceLevel = 'EXACT' | 'DERIVED' | 'UNAVAILABLE';
export type SimTime = Readonly<{ ticks: string; timescaleFs: string; domain?: string }>;
export type Selection = Readonly<{
  schemaVersion: '1.0'; projectId: string; originId: string; evidenceLevel: EvidenceLevel;
  runId?: string; ipInstanceId?: string; hierarchyPath?: string; signalId?: string;
  sourceLocation?: Readonly<{ fileId: string; line: number; column?: number }>;
  transactionId?: string; simTime?: SimTime;
}>;
export type WindowRequest = Readonly<{
  runId: string; traceId: string; startTicks: string; endTicks: string;
  signalIds: readonly string[]; maxSamples: number; maxBytes: number;
}>;
export type Mapping = Readonly<{
  evidenceLevel: EvidenceLevel; selection?: Selection; reason?: string;
}>;
export interface WaveformAdapter {
  open(runId: string, traceArtifactId: string): Promise<void>;
  setWindow(request: WindowRequest): Promise<void>;
  select(selection: Selection): Promise<Mapping>;
  onSelection(listener: (selection: Selection) => void): () => void;
  dispose(): void;
}
export interface SchematicAdapter {
  open(netlistArtifactId: string, mappingArtifactId?: string): Promise<void>;
  select(selection: Selection): Promise<Mapping>;
  onSelection(listener: (selection: Selection) => void): () => void;
  dispose(): void;
}
