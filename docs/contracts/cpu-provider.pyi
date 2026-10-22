"""Design-only interface; no provider is implemented or discoverable in M0."""
from dataclasses import dataclass
from typing import Literal, Protocol

Lane = Literal['rtl_standalone', 'rtl_cpu_soc', 'gem5_arch', 'gem5_hybrid']
CapabilityStatus = Literal['SUPPORTED', 'EXPERIMENTAL', 'UNSUPPORTED']

@dataclass(frozen=True)
class Diagnostic:
    code: str
    message: str
    evidence_ids: tuple[str, ...]

@dataclass(frozen=True)
class SourcePin:
    repository: str
    revision: str
    content_sha256: str

@dataclass(frozen=True)
class CPUProfile:
    schema_version: Literal['1.0']
    profile_id: str
    provider_id: str
    isa: str
    xlen: Literal[32, 64]
    source: SourcePin
    generator_config_sha256: str

@dataclass(frozen=True)
class ProfileValidation:
    valid: bool
    diagnostics: tuple[Diagnostic, ...]

@dataclass(frozen=True)
class SourceResolution:
    pins: tuple[SourcePin, ...]
    lock_sha256: str

@dataclass(frozen=True)
class BuildWorkspace:
    source_snapshot_id: str
    output_workspace_id: str
    toolchain_image_digest: str

@dataclass(frozen=True)
class BuildResult:
    status: Literal['COMPLETE', 'FAILED', 'BLOCKED']
    artifact_ids: tuple[str, ...]
    diagnostics: tuple[Diagnostic, ...]

@dataclass(frozen=True)
class BootContract:
    entry_address: str
    memory_base: str
    memory_size: str
    firmware_formats: tuple[Literal['elf', 'bin', 'vmem'], ...]

@dataclass(frozen=True)
class LaneCapability:
    lane: Lane
    status: CapabilityStatus
    reason: str
    evidence_ids: tuple[str, ...]

@dataclass(frozen=True)
class LicenseManifest:
    expression: str
    license_artifact_ids: tuple[str, ...]
    audit_status: Literal['APPROVED', 'REVIEW_REQUIRED', 'REJECTED']

class CPUProvider(Protocol):
    def discover(self) -> tuple[CPUProfile, ...]: ...
    def validate_profile(self, profile: CPUProfile) -> ProfileValidation: ...
    def resolve_sources(self, profile: CPUProfile) -> SourceResolution: ...
    def build(self, profile: CPUProfile, workspace: BuildWorkspace) -> BuildResult: ...
    def boot_contract(self, profile: CPUProfile) -> BootContract: ...
    def supported_lanes(self, profile: CPUProfile) -> tuple[LaneCapability, ...]: ...
    def license_manifest(self, profile: CPUProfile) -> LicenseManifest: ...
