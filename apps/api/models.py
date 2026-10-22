from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class Contract(BaseModel):
    model_config = ConfigDict(extra='forbid')


class ProjectCreate(Contract):
    name: str = Field(min_length=1, max_length=100)


class SourceFile(Contract):
    path: str = Field(min_length=1, max_length=240)
    content: str = Field(max_length=1_000_000)


class ImportRequest(Contract):
    files: list[SourceFile] = Field(min_length=1, max_length=128)
    license_expression: str = Field(default='NOASSERTION', min_length=1, max_length=160)
    redistribution: Literal['allowed', 'forbidden', 'review_required'] = 'review_required'
    parent_import_id: str | None = None


class AnalyzeRequest(Contract):
    top: str | None = Field(default=None, pattern=r'^[a-zA-Z_][a-zA-Z0-9_$]*$', max_length=120)


class LayoutRequest(Contract):
    revision: int = Field(ge=0)
    layout: dict[str, Any]


class PackageRequest(Contract):
    import_id: str
    analysis_run_id: str
    namespace: str = Field(pattern=r'^[a-zA-Z0-9_-]+$', max_length=60)
    library: str = Field(default='rtl', pattern=r'^[a-zA-Z0-9_-]+$', max_length=60)
    name: str = Field(pattern=r'^[a-zA-Z0-9_-]+$', max_length=80)
    version: str = Field(default='1.0.0', pattern=r'^\d+\.\d+\.\d+$', max_length=30)


class ReviewRequest(Contract):
    acknowledge_unverified: Literal[True]
    reviewer: str = Field(min_length=1, max_length=100)


class ReuseRequest(Contract):
    project_id: str
    acknowledge_unverified: Literal[True]


class BusInterface(Contract):
    id: str = Field(pattern=r'^[a-zA-Z0-9_-]+$')
    protocol: Literal['AXI4-Lite', 'AXI4', 'APB', 'TL-UL', 'TileLink', 'generic_tlm', 'pin']
    role: Literal['initiator', 'target']
    data_width: int = Field(ge=1, le=1024)
    address_width: int = Field(ge=1, le=128)
    clock_domain: str
    provenance: Literal['EXTRACTED', 'INFERRED', 'REVIEWED'] = 'REVIEWED'
    evidence_ids: list[str] = Field(default_factory=list)
    adapter_contract: Literal['direct_v1'] = 'direct_v1'


class Instance(Contract):
    id: str = Field(pattern=r'^[a-zA-Z_][a-zA-Z0-9_-]*$', max_length=80)
    ip_id: str
    interfaces: list[BusInterface] = Field(default_factory=list, max_length=64)


class AddressRegion(Contract):
    id: str
    instance_id: str
    base: str = Field(pattern=r'^0x[0-9a-fA-F]{1,32}$')
    size: str = Field(pattern=r'^0x[0-9a-fA-F]{1,32}$')
    alignment: str = Field(default='0x4', pattern=r'^0x[0-9a-fA-F]{1,32}$')


class Endpoint(Contract):
    instance_id: str
    interface_id: str


class Connection(Contract):
    id: str
    from_: Endpoint = Field(alias='from')
    to: Endpoint
    adapter_contract: Literal['direct_v1'] = 'direct_v1'


class Clock(Contract):
    id: str
    frequency_hz: int = Field(ge=1, le=10**12)


class Reset(Contract):
    id: str
    clock_domain: str
    active_low: bool
    asynchronous: bool


class SoCConfig(Contract):
    schema_version: Literal['1.0'] = '1.0'
    id: str
    project_id: str
    revision: int = Field(ge=0)
    address_width: int = Field(default=32, ge=1, le=128)
    lane: Literal['rtl_standalone', 'rtl_cpu_soc', 'gem5_arch', 'gem5_hybrid'] = 'rtl_standalone'
    instances: list[Instance] = Field(default_factory=list, max_length=256)
    address_regions: list[AddressRegion] = Field(default_factory=list, max_length=512)
    connections: list[Connection] = Field(default_factory=list, max_length=512)
    clocks: list[Clock] = Field(default_factory=list, max_length=64)
    resets: list[Reset] = Field(default_factory=list, max_length=64)


class RunRequest(Contract):
    project_id: str
    kind: Literal['simulation'] = 'simulation'
    lane: Literal['rtl_standalone', 'rtl_cpu_soc', 'gem5_arch', 'gem5_hybrid']


class FirmwareRequest(Contract):
    project_id: str
    profile_id: Literal['ibex_simple_system_small'] = 'ibex_simple_system_small'
    filename: str = Field(min_length=1, max_length=150)
    content_base64: str = Field(max_length=3_000_000)


class RuntimeRequest(Contract):
    project_id: str
    profile_id: Literal['picorv32_icarus','picorv32_verilator','systemc_tlm','systemc_verilated','yosys_netlist','gem5_riscv','gem5_tlm_roundtrip','ibex_simple_system']
    scenario: Literal['baseline','backpressure','negative_control'] = 'baseline'

