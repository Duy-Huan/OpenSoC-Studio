export type Project = {
  id: string;
  name: string;
  created_at: string;
  ai_policy: "NO_AI";
};
export type Source = { id: string; path: string; sha256: string; size: number };
export type Import = {
  id: string;
  project_id: string;
  snapshot_sha256: string;
  files: Source[];
  rights: { license_expression: string; redistribution: string };
};
export type SourceLocation = { file: string; line: number; column: number };
export type Port = {
  name: string;
  direction: string;
  width: number;
  type: string;
  source: SourceLocation;
  provenance: string;
};
export type HardwareNode = {
  id: string;
  name: string;
  module: string;
  source: SourceLocation;
  ports: Port[];
  children: HardwareNode[];
  provenance: string;
};
export type Diagnostic = {
  code: string;
  severity: string;
  message: string;
  file: string;
  line: number;
  column: number;
};
export type Analysis = {
  tool: string;
  tool_version: string;
  hierarchy: HardwareNode[];
  diagnostics: Diagnostic[];
  success: boolean;
  simulation_executed: false;
};
export type Run = {
  id: string;
  project_id: string;
  import_id: string;
  kind: string;
  state: string;
  reason?: string;
  result: Analysis | null;
  manifest_sha256: string;
  artifacts: { id: string; sha256: string; kind: string; size: number }[];
};
export type RunEvent = {
  seq: number;
  run_id: string;
  kind: string;
  data: Record<string, unknown>;
};
export type Selection = {
  schemaVersion: "1.0";
  projectId: string;
  runId?: string;
  originId: string;
  evidenceLevel: "EXACT" | "DERIVED" | "UNAVAILABLE";
  hierarchyPath?: string;
  signalId?: string;
  sourceLocation?: { fileId: string; line: number; column?: number };
};
export type Package = {
  id: string;
  status: string;
  content_sha256: string;
  simulation_verified: boolean;
  knowledge_level: string;
  hierarchy: HardwareNode[];
  rights: Import["rights"];
};
export type Bus = {
  id: string;
  protocol:
    "AXI4-Lite" | "AXI4" | "APB" | "TL-UL" | "TileLink" | "generic_tlm" | "pin";
  role: "initiator" | "target";
  data_width: number;
  address_width: number;
  clock_domain: string;
  provenance: "REVIEWED";
  evidence_ids: string[];
  adapter_contract: "direct_v1";
};
export type Instance = { id: string; ip_id: string; interfaces: Bus[] };
export type Region = {
  id: string;
  instance_id: string;
  base: string;
  size: string;
  alignment: string;
};
export type Soc = {
  schema_version: "1.0";
  id: string;
  project_id: string;
  revision: number;
  address_width: number;
  lane: "rtl_standalone";
  instances: Instance[];
  address_regions: Region[];
  connections: {
    id: string;
    from: { instance_id: string; interface_id: string };
    to: { instance_id: string; interface_id: string };
    adapter_contract: "direct_v1";
  }[];
  clocks: { id: string; frequency_hz: number }[];
  resets: {
    id: string;
    clock_domain: string;
    active_low: boolean;
    asynchronous: boolean;
  }[];
};
export type TopologyError = { code: string; id: string; message: string };
export type Provider = {
  id: string;
  status: string;
  reason: string;
  revision: string;
};
