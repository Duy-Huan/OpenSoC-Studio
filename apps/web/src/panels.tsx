import { useEffect, useState } from "react";
import { useStudio } from "./store";
import { api, post, terminal } from "./api";
import { Icon } from "./icons";
import type { HardwareNode, Package, SourceLocation } from "./types";
import type { FirmwareRequest } from "./api-contracts";

export function Empty({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={30} />
      </div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function ExplorerPanel() {
  const s = useStudio();
  const [tab, setTab] = useState("sources");
  const [filter, setFilter] = useState("");
  return (
    <div className="explorer panel-scroll">
      <div className="panel-switch">
        {["sources", "library", "cpu"].map((x) => (
          <button
            className={x === tab ? "active" : ""}
            onClick={() => setTab(x)}
            key={x}
          >
            {x === "cpu" ? "CPU" : x}
          </button>
        ))}
      </div>
      <div className="search-box">
        <Icon name="search" size={14} />
        <input
          aria-label="Filter explorer"
          placeholder={
            tab === "sources" ? "Find file or module…" : "Search catalog…"
          }
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {tab === "sources" && (
        <>
          <div className="section-label">
            PROJECT FILES <span>{s.currentImport?.files.length ?? 0}</span>
          </div>
          {s.currentImport ? (
            <>
              <div className="tree-folder">
                <Icon name="folder" size={15} /> {s.project?.name}
              </div>
              {s.currentImport.files
                .filter((f) => f.path.includes(filter))
                .map((f) => (
                  <button
                    key={f.id}
                    className={`file-row ${s.source?.id === f.id ? "selected" : ""}`}
                    onClick={() => s.selectSource(f)}
                  >
                    <span className="filetype">SV</span>
                    <span>{f.path}</span>
                  </button>
                ))}
              <div className="snapshot-info">
                <span className="dot" /> SNAPSHOT{" "}
                <code>{s.currentImport.snapshot_sha256.slice(0, 10)}</code>
              </div>
            </>
          ) : (
            <p className="muted inset">
              Import a SystemVerilog fileset to begin.
            </p>
          )}
          <div className="section-label spaced">
            RTL HIERARCHY <span>{s.run?.result?.hierarchy.length ?? 0}</span>
          </div>
          {s.run?.result?.hierarchy.map((n) => (
            <Hierarchy key={n.id} node={n} filter={filter} />
          ))}
          {!s.run?.result && (
            <p className="muted inset">
              Run analysis to elaborate your design.
            </p>
          )}
          {s.imports.length > 1 && (
            <>
              <div className="section-label spaced">SOURCE REVISIONS</div>
              {s.imports.map((item) => (
                <button
                  className="revision-row"
                  key={item.id}
                  onClick={() => s.openImport(item)}
                >
                  <Icon name="files" size={13} />
                  <code>{item.snapshot_sha256.slice(0, 12)}</code>
                  {item.id === s.currentImport?.id && (
                    <span className="tiny-tag">active</span>
                  )}
                </button>
              ))}
            </>
          )}
        </>
      )}
      {tab === "library" && (
        <>
          <div className="section-label">
            LOCAL IP LIBRARY <span>{s.packages.length}</span>
          </div>
          {s.packages
            .filter((p) => p.id.includes(filter))
            .map((p) => (
              <div className="catalog-card" key={p.id}>
                <Icon name="chip" />
                <strong>{p.id.split(":")[2]}</strong>
                <code>{p.id}</code>
                <span className="tag amber">{p.status} · unverified</span>
              </div>
            ))}
          {!s.packages.length && (
            <p className="muted inset">
              Package an analyzed source from the IP Registry tab.
            </p>
          )}
        </>
      )}
      {tab === "cpu" && (
        <>
          <div className="section-label">PINNED CPU PROVIDERS</div>
          {s.providers
            .filter((p) => p.id.includes(filter))
            .map((p) => (
              <div className="catalog-card" key={p.id}>
                <strong>{p.id.replaceAll("_", " ")}</strong>
                <span className="tag neutral">UNAVAILABLE</span>
                <p>{p.reason}</p>
                <code>rev {p.revision.slice(0, 12)}</code>
              </div>
            ))}
        </>
      )}
      <div className="explorer-foot">
        <Icon name="settings" size={14} />
        <span>Local workspace</span>
        <span className="tag mint">AI OFF</span>
      </div>
    </div>
  );
}

function Hierarchy({
  node,
  filter,
  depth = 0,
}: {
  node: HardwareNode;
  filter: string;
  depth?: number;
}) {
  const s = useStudio();
  const [expanded, setExpanded] = useState(true);
  if (
    filter &&
    !JSON.stringify(node).toLowerCase().includes(filter.toLowerCase())
  )
    return null;
  return (
    <div>
      <div
        className={`hierarchy-row ${s.selection?.hierarchyPath === node.id ? "selected" : ""}`}
        style={{ paddingLeft: 14 + depth * 12 }}
      >
        <button
          aria-label={`Expand ${node.id}`}
          className="icon-button"
          onClick={() => setExpanded(!expanded)}
        >
          <Icon
            name="chevron"
            size={11}
            style={{ transform: expanded ? "rotate(90deg)" : undefined }}
          />
        </button>
        <button onClick={() => s.select(node.source, node.id)}>
          <Icon name="chip" size={13} />
          <span>{node.name}</span>
          <small>{node.module}</small>
        </button>
      </div>
      {expanded && (
        <>
          {node.ports.map((p) => (
            <button
              key={p.name}
              className="port-row"
              style={{ paddingLeft: 35 + depth * 12 }}
              onClick={() => s.select(p.source, node.id)}
            >
              <span
                className={
                  p.direction === "input" ? "port-input" : "port-output"
                }
              >
                {p.direction === "input" ? "↘" : "↗"}
              </span>
              {p.name}
              <small>{p.width}b</small>
            </button>
          ))}
          {node.children.map((n) => (
            <Hierarchy node={n} key={n.id} depth={depth + 1} filter={filter} />
          ))}
        </>
      )}
    </div>
  );
}

export function InspectorPanel() {
  const s = useStudio();
  function flatten(nodes: HardwareNode[]): HardwareNode[] {
    return nodes.flatMap((n) => [n, ...flatten(n.children)]);
  }
  const nodes = flatten(s.run?.result?.hierarchy ?? []);
  const node =
    nodes.find((n) => n.id === s.selection?.hierarchyPath) ?? nodes[0];
  return (
    <div className="inspector panel-scroll">
      <div className="section-label">DESIGN CONTEXT</div>
      <div className="context-card">
        <div className="context-icon">
          <Icon name="chip" size={23} />
        </div>
        <div>
          <strong>{node?.module ?? "No module selected"}</strong>
          <span>
            {node ? "Elaborated RTL module" : "Import and analyze a source"}
          </span>
        </div>
      </div>
      <div className="property-group">
        <div className="section-label">EVIDENCE</div>
        <dl>
          <dt>Knowledge</dt>
          <dd>
            <span className={`tag ${node ? "mint" : "neutral"}`}>
              {node ? "EXTRACTED" : "UNAVAILABLE"}
            </span>
          </dd>
          <dt>Analysis</dt>
          <dd>
            {s.run?.result
              ? `slang ${s.run.result.tool_version}`
              : "Not executed"}
          </dd>
          <dt>Simulation</dt>
          <dd className="amber-text">Not executed</dd>
          <dt>Source mapping</dt>
          <dd>
            {s.selection?.evidenceLevel ?? (node ? "EXACT" : "UNAVAILABLE")}
          </dd>
        </dl>
      </div>
      {node && (
        <>
          <div className="property-group">
            <div className="section-label">MODULE DETAILS</div>
            <dl>
              <dt>Instance</dt>
              <dd className="mono">{node.id}</dd>
              <dt>Source</dt>
              <dd>
                <button
                  className="text-button mono"
                  onClick={() => s.select(node.source, node.id)}
                >
                  {node.source.file}:{node.source.line}
                </button>
              </dd>
              <dt>Ports</dt>
              <dd>{node.ports.length}</dd>
              <dt>Children</dt>
              <dd>{node.children.length}</dd>
            </dl>
          </div>
          <div className="section-label spaced">
            PORT CONTRACT <span>{node.ports.length}</span>
          </div>
          <div className="ports-table">
            <div className="port-head">
              <span>NAME</span>
              <span>DIR</span>
              <span>BITS</span>
            </div>
            {node.ports.map((p) => (
              <button key={p.name} onClick={() => s.select(p.source, node.id)}>
                <span>{p.name}</span>
                <span>{p.direction}</span>
                <span>{p.width}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="property-group">
        <div className="section-label">SOURCE RIGHTS</div>
        <dl>
          <dt>License</dt>
          <dd>
            {s.currentImport?.rights.license_expression ?? "Not specified"}
          </dd>
          <dt>Redistribution</dt>
          <dd>
            {s.currentImport?.rights.redistribution.replaceAll("_", " ") ??
              "Needs review"}
          </dd>
        </dl>
      </div>
      <div className="info-callout">
        <Icon name="warning" size={15} />
        <p>
          Port structure comes from the compiler. Bus behavior, register
          semantics and CPU fidelity require separate review and tests.
        </p>
      </div>
    </div>
  );
}

export function ConsolePanel() {
  const s = useStudio();
  const [tab, setTab] = useState("log");
  async function download() {
    if (!s.run) return;
    const evidence = await api(`/runs/${s.run.id}/evidence`);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(evidence, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${s.run.id}-evidence.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function jump(loc: SourceLocation) {
    s.select(loc);
  }
  return (
    <div className="console-panel">
      <div className="console-toolbar">
        <button
          className={tab === "log" ? "active" : ""}
          onClick={() => setTab("log")}
        >
          Output
        </button>
        <button
          className={tab === "problems" ? "active" : ""}
          onClick={() => setTab("problems")}
        >
          Problems{" "}
          <span className="count">
            {s.run?.result?.diagnostics.length ?? 0}
          </span>
        </button>
        <span className="flex-spacer" />
        {s.run && (
          <>
            <span
              className={`tag ${s.run.state === "COMPLETED_PASS" ? "mint" : "neutral"}`}
              data-testid="run-state"
            >
              {s.run.state.replaceAll("_", " ")}
            </span>
            {!terminal(s.run.state) && (
              <button
                className="text-button"
                onClick={() =>
                  void post(`/runs/${s.run?.id}/cancel`).catch(s.error)
                }
              >
                Cancel
              </button>
            )}
            <button
              className="icon-button"
              title="Export actual run evidence"
              onClick={() => void download().catch(s.error)}
            >
              <Icon name="download" size={15} />
            </button>
          </>
        )}
      </div>
      <div className="console-output" role="log">
        {!s.run && (
          <div className="console-placeholder">
            <span className="console-prompt">›</span> Ready. Import a fileset
            and run RTL analysis.
            <br />
            <span className="console-subtle">
              Local execution · no cloud services · simulator worker unavailable
            </span>
          </div>
        )}
        {tab === "log"
          ? s.events.map((e) => (
              <div
                key={e.seq}
                className={`log-line ${e.kind === "warning" ? "log-warning" : ""}`}
              >
                <span className="log-seq">
                  {String(e.seq).padStart(3, "0")}
                </span>
                <span className="log-kind">{e.kind}</span>
                <span>
                  {typeof e.data.message === "string"
                    ? e.data.message
                    : e.kind === "job.state"
                      ? String(e.data.state).replaceAll("_", " ")
                      : e.kind === "run.verdict"
                        ? `${e.data.scope}: ${e.data.verdict} · simulation not executed`
                        : JSON.stringify(e.data)}
                </span>
              </div>
            ))
          : s.run?.result?.diagnostics.map((d, i) => (
              <button
                className="diagnostic"
                key={i}
                onClick={() =>
                  jump({ file: d.file, line: d.line, column: d.column })
                }
              >
                <span
                  className={`tag ${d.severity === "error" ? "red" : "amber"}`}
                >
                  {d.severity}
                </span>
                <span>{d.message}</span>
                <code>
                  {d.file}:{d.line}
                </code>
              </button>
            ))}
        {tab === "problems" &&
          s.run?.result &&
          !s.run.result.diagnostics.length && (
            <span className="muted">
              No compiler diagnostics in this source snapshot.
            </span>
          )}
      </div>
    </div>
  );
}

export function RegistryPanel() {
  const s = useStudio();
  const [name, setName] = useState("");
  const [namespace, setNamespace] = useState("local");
  const [version, setVersion] = useState("1.0.0");
  async function create() {
    if (!s.currentImport || !s.run) return;
    const p = await post<Package>("/ip-packages", {
      import_id: s.currentImport.id,
      analysis_run_id: s.run.id,
      namespace,
      name,
      version,
    });
    s.setPackages((old) => [p, ...old]);
    s.setNotice(
      `Created immutable package ${p.id}. Protocol verification remains unavailable.`,
    );
  }
  async function review(p: Package) {
    const updated = await post<Package>(`/ip-packages/${p.id}/review`, {
      reviewer: "Local workspace owner",
      acknowledge_unverified: true,
    });
    s.setPackages((old) => old.map((x) => (x.id === p.id ? updated : x)));
  }
  return (
    <div className="registry panel-scroll">
      <div className="view-heading">
        <div>
          <span className="eyebrow">REUSE WITH PROVENANCE</span>
          <h2>IP Registry</h2>
          <p>
            Immutable source versions, explicit rights, reviewable evidence.
          </p>
        </div>
        <span className="tag neutral">LOCAL CATALOG</span>
      </div>
      <div className="package-form">
        <h3>Package the current source snapshot</h3>
        <div className="form-row">
          <label>
            Namespace
            <input
              aria-label="Package namespace"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
            />
          </label>
          <label>
            IP name
            <input
              aria-label="Package name"
              placeholder="register_bank"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Version
            <input
              aria-label="Package version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </label>
        </div>
        <div className="form-footer">
          <span className="muted">
            Requires successful RTL analysis. New packages start as DRAFT.
          </span>
          <button
            className="primary"
            disabled={!name || !s.run?.result?.success}
            onClick={() => void create().catch(s.error)}
          >
            <Icon name="plus" size={15} /> Create IP draft
          </button>
        </div>
      </div>
      <div className="section-label spaced">
        PACKAGED SOURCES <span>{s.packages.length}</span>
      </div>
      {s.packages.map((p) => (
        <div className="registry-item" key={p.id}>
          <div className="registry-icon">
            <Icon name="chip" size={25} />
          </div>
          <div className="registry-details">
            <strong>{p.id}</strong>
            <code>sha256:{p.content_sha256.slice(0, 20)}</code>
            <div>
              <span className="tag amber">{p.status}</span>{" "}
              <span className="muted">
                {p.rights.license_expression} · simulation unverified
              </span>
            </div>
          </div>
          <div className="registry-actions">
            {p.status === "DRAFT" ? (
              <button
                className="secondary"
                onClick={() => void review(p).catch(s.error)}
              >
                Review metadata
              </button>
            ) : (
              <button
                className="secondary"
                onClick={() =>
                  void post(`/ip-packages/${p.id}/reuse`, {
                    project_id: s.project?.id,
                    acknowledge_unverified: true,
                  })
                    .then(() =>
                      s.setNotice(
                        "Pinned reviewed package in this project. It remains simulation-unverified.",
                      ),
                    )
                    .catch(s.error)
                }
              >
                Pin to project
              </button>
            )}
            <button
              disabled
              className="small-button"
              title="Requires deterministic simulation evidence"
            >
              Publish gated
            </button>
          </div>
        </div>
      ))}
      {!s.packages.length && (
        <Empty icon="library" title="Your reusable IP starts here">
          <p>Analyze a real source, then package its exact snapshot.</p>
        </Empty>
      )}
    </div>
  );
}

export function WaveformPanel() {
  const s = useStudio();
  return (
    <Empty icon="wave" title="No waveform artifact available">
      <p>
        The current analysis job does not execute RTL.
        <br />
        Waveforms require a configured simulator worker and a real trace.
      </p>
      <p>
        The separate RTL Regression view offers VCD downloads from the fixed
        PicoRV32 reference run.
      </p>
      <div className="empty-status">
        <span className="tag amber">SIMULATION UNAVAILABLE</span>
        <span>Wellen / native trace integration pending</span>
      </div>
      <button
        className="secondary"
        onClick={() =>
          s.setNotice(
            "This analysis has no waveform. Open Engine Runtime to build fixed reference systems and browse actual Wellen trace windows.",
          )
        }
      >
        View capability status
      </button>
    </Empty>
  );
}

type Firmware = {
  id: string;
  filename: string;
  size: number;
  entry: string;
  xlen: number;
  artifact_sha256: string;
  compatibility: string;
  boot_verified: false;
  segments: {
    address: string;
    file_size: number;
    memory_size: number;
    flags: number;
  }[];
};
export function FirmwarePanel() {
  const s = useStudio();
  const [images, setImages] = useState<Firmware[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (s.project)
      void api<Firmware[]>(`/projects/${s.project.id}/firmware`)
        .then(setImages)
        .catch(s.error);
  }, [s.project?.id]);
  async function inspect(file: File) {
    if (!s.project) return;
    if (file.size > 2000000) {
      s.setNotice("ELF import limit is 2 MB.");
      return;
    }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const request: FirmwareRequest = {
        project_id: s.project.id,
        profile_id: "ibex_simple_system_small",
        filename: file.name,
        content_base64: btoa(binary),
      };
      const image = await post<Firmware>("/firmware/import", request);
      setImages((old) => [image, ...old.filter((x) => x.id !== image.id)]);
      s.setNotice(
        "ELF structural checks passed. Firmware has not been executed or boot-verified.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="registry panel-scroll">
      <div className="view-heading">
        <div>
          <span className="eyebrow">BARE-METAL IMAGE VALIDATION</span>
          <h2>Firmware</h2>
          <p>
            Inspect ELF metadata against a pinned CPU board contract before
            execution.
          </p>
        </div>
        <span className="tag amber">BOOT UNVERIFIED</span>
      </div>
      <div className="package-form">
        <h3>Ibex Simple System · small</h3>
        <div className="firmware-contract">
          <span>
            ISA <strong>ELF32 RISC-V</strong>
          </span>
          <span>
            RAM <code>0x100000 – 0x200000</code>
          </span>
          <span>
            Boot entry <code>0x100080</code>
          </span>
          <span>
            Revision <code>1b29dae8866e</code>
          </span>
        </div>
        <p className="muted">
          Header, ABI and LOAD-segment bounds are checked locally. Full
          ISA-extension compatibility and firmware behavior need actual CPU
          execution. Fixed reference execution is available separately in Engine
          Runtime.
        </p>
        <label className="file-drop">
          <Icon name="files" size={25} />
          <strong>{busy ? "Inspecting ELF…" : "Choose an ELF image"}</strong>
          <span>Maximum 2 MB · no firmware execution</span>
          <input
            aria-label="Firmware ELF file"
            type="file"
            accept=".elf"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void inspect(file).catch(s.error);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="section-label spaced">
        IMPORTED IMAGES <span>{images.length}</span>
      </div>
      {images.map((image) => (
        <div className="firmware-image" key={image.id}>
          <strong>{image.filename}</strong>
          <span className="tag mint">STRUCTURAL CHECKS PASSED</span>
          <dl>
            <dt>Entry</dt>
            <dd>{image.entry}</dd>
            <dt>Image class</dt>
            <dd>ELF{image.xlen}</dd>
            <dt>SHA256</dt>
            <dd>{image.artifact_sha256}</dd>
            <dt>CPU boot</dt>
            <dd className="amber-text">NOT EXECUTED</dd>
          </dl>
          {image.segments.map((segment, i) => (
            <div className="firmware-segment" key={i}>
              LOAD @ {segment.address} · {segment.file_size} file bytes /{" "}
              {segment.memory_size} memory bytes
            </div>
          ))}
        </div>
      ))}
      {!images.length && (
        <p className="muted inset">
          No firmware imported. Structural validity does not imply a successful
          CPU boot.
        </p>
      )}
    </div>
  );
}
