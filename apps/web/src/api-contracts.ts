// Generated from FastAPI OpenAPI by infra/scripts/export-contracts.py. Do not edit.

export type AddressRegion = {
  id: string;
  instance_id: string;
  base: string;
  size: string;
  alignment?: string;
};

export type AnalyzeRequest = {
  top?: string | null;
};

export type BusInterface = {
  id: string;
  protocol:
    "AXI4-Lite" | "AXI4" | "APB" | "TL-UL" | "TileLink" | "generic_tlm" | "pin";
  role: "initiator" | "target";
  data_width: number;
  address_width: number;
  clock_domain: string;
  provenance?: "EXTRACTED" | "INFERRED" | "REVIEWED";
  evidence_ids?: Array<string>;
  adapter_contract?: "direct_v1";
};

export type Clock = {
  id: string;
  frequency_hz: number;
};

export type Connection = {
  id: string;
  from: Endpoint;
  to: Endpoint;
  adapter_contract?: "direct_v1";
};

export type Endpoint = {
  instance_id: string;
  interface_id: string;
};

export type FirmwareRequest = {
  project_id: string;
  profile_id?: "ibex_simple_system_small";
  filename: string;
  content_base64: string;
};

export type HTTPValidationError = {
  detail?: Array<ValidationError>;
};

export type ImportRequest = {
  files: Array<SourceFile>;
  license_expression?: string;
  redistribution?: "allowed" | "forbidden" | "review_required";
  parent_import_id?: string | null;
};

export type Instance = {
  id: string;
  ip_id: string;
  interfaces?: Array<BusInterface>;
};

export type LayoutRequest = {
  revision: number;
  layout: Record<string, unknown>;
};

export type PackageRequest = {
  import_id: string;
  analysis_run_id: string;
  namespace: string;
  library?: string;
  name: string;
  version?: string;
};

export type ProjectCreate = {
  name: string;
};

export type Reset = {
  id: string;
  clock_domain: string;
  active_low: boolean;
  asynchronous: boolean;
};

export type ReuseRequest = {
  project_id: string;
  acknowledge_unverified: true;
};

export type ReviewRequest = {
  acknowledge_unverified: true;
  reviewer: string;
};

export type RunRequest = {
  project_id: string;
  kind?: "simulation";
  lane: "rtl_standalone" | "rtl_cpu_soc" | "gem5_arch" | "gem5_hybrid";
};

export type RuntimeRequest = {
  project_id: string;
  profile_id:
    | "picorv32_icarus"
    | "picorv32_verilator"
    | "systemc_tlm"
    | "systemc_verilated"
    | "yosys_netlist"
    | "gem5_riscv"
    | "gem5_tlm_roundtrip"
    | "ibex_simple_system";
  scenario?: "baseline" | "backpressure" | "negative_control";
};

export type SoCConfig = {
  schema_version?: "1.0";
  id: string;
  project_id: string;
  revision: number;
  address_width?: number;
  lane?: "rtl_standalone" | "rtl_cpu_soc" | "gem5_arch" | "gem5_hybrid";
  instances?: Array<Instance>;
  address_regions?: Array<AddressRegion>;
  connections?: Array<Connection>;
  clocks?: Array<Clock>;
  resets?: Array<Reset>;
};

export type SourceFile = {
  path: string;
  content: string;
};

export type ValidationError = {
  loc: Array<string | number>;
  msg: string;
  type: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
};
