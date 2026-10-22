import { useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  applyNodeChanges,
  type Node,
  type NodeProps,
  type Connection,
} from "@xyflow/react";
import { useStudio } from "./store";
import { api, post, ApiError } from "./api";
import { Icon } from "./icons";
import type { Instance, Soc, TopologyError, Bus } from "./types";

type HardwareData = { instance: Instance; errors: TopologyError[] };
type HardwareFlowNode = Node<HardwareData, "hardware">;
function HardwareCard({ data }: NodeProps<HardwareFlowNode>) {
  const instance = data.instance;
  return (
    <div className={`hardware-node ${data.errors.length ? "invalid" : ""}`}>
      <div className="hardware-heading">
        <span className="node-icon">
          <Icon name="chip" size={17} />
        </span>
        <strong>{instance.id}</strong>
        <span className="node-kind">IP</span>
      </div>
      <div className="hardware-package">
        {instance.ip_id.split(":").slice(0, 3).join(":")}
      </div>
      {instance.interfaces.map((p, index) => (
        <div className="hardware-port" key={p.id}>
          <Handle
            id={p.id}
            type={p.role === "initiator" ? "source" : "target"}
            position={p.role === "initiator" ? Position.Right : Position.Left}
            style={{ top: 77 + index * 28 }}
          />
          <span>
            {p.role === "target" ? "↘" : "↗"} {p.id}
          </span>
          <small>
            {p.protocol} / {p.data_width}
          </small>
        </div>
      ))}
      {data.errors.length > 0 && (
        <div className="node-error">{data.errors[0].code}</div>
      )}
      <div className="node-provenance">
        Reviewed mapping · protocol unverified
      </div>
    </div>
  );
}
const nodeTypes = { hardware: HardwareCard };

export function ComposerPanel() {
  const s = useStudio();
  const [nodes, setNodes] = useState<HardwareFlowNode[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("ip0");
  const [packageId, setPackageId] = useState("");
  const [role, setRole] = useState<"initiator" | "target">("target");
  const [protocol, setProtocol] = useState<Bus["protocol"]>("AXI4-Lite");
  const [message, setMessage] = useState("");
  const model = s.soc;
  useEffect(() => {
    if (!model) return;
    setNodes((old) =>
      model.instances.map((instance, i) => ({
        id: instance.id,
        type: "hardware",
        position: old.find((n) => n.id === instance.id)?.position ??
          s.workspace?.layout.graphPositions?.[instance.id] ?? {
            x: 80 + (i % 3) * 300,
            y: 70 + Math.floor(i / 3) * 200,
          },
        data: {
          instance,
          errors: s.topologyErrors.filter(
            (e) =>
              e.id === instance.id ||
              model.address_regions.some(
                (r) => r.id === e.id && r.instance_id === instance.id,
              ) ||
              model.connections.some(
                (c) =>
                  c.id === e.id &&
                  [c.from.instance_id, c.to.instance_id].includes(instance.id),
              ),
          ),
        },
      })),
    );
  }, [model, s.topologyErrors]);
  function change(value: Soc) {
    s.setSoc(value);
    s.setSocDirty(true);
    setMessage("");
  }
  function add() {
    if (!model || !packageId || !name) return;
    const instance: Instance = {
      id: name,
      ip_id: packageId,
      interfaces: [
        {
          id: role === "initiator" ? "master" : "control",
          protocol,
          role,
          data_width: 32,
          address_width: model.address_width,
          clock_domain: "core",
          provenance: "REVIEWED",
          evidence_ids: [],
          adapter_contract: "direct_v1",
        },
      ],
    };
    change({
      ...model,
      instances: [...model.instances, instance],
      clocks: model.clocks.length
        ? model.clocks
        : [{ id: "core", frequency_hz: 100000000 }],
    });
    setShowAdd(false);
    setName(`ip${model.instances.length + 1}`);
  }
  function connect(edge: Connection) {
    if (
      !model ||
      !edge.source ||
      !edge.target ||
      !edge.sourceHandle ||
      !edge.targetHandle
    )
      return;
    change({
      ...model,
      connections: [
        ...model.connections,
        {
          id: `edge-${crypto.randomUUID().slice(0, 8)}`,
          from: { instance_id: edge.source, interface_id: edge.sourceHandle },
          to: { instance_id: edge.target, interface_id: edge.targetHandle },
          adapter_contract: "direct_v1",
        },
      ],
    });
  }
  async function validate(commit = false) {
    if (!model) return;
    try {
      const result = await post<{ valid: boolean; errors: TopologyError[] }>(
        `/soc-configs/${model.id}/validate`,
        model,
      );
      s.setTopologyErrors(result.errors);
      if (!result.valid) {
        setMessage(
          `${result.errors.length} error(s) — topology has not been committed.`,
        );
        return;
      }
      if (commit) {
        const saved = await api<Soc>(`/soc-configs/${model.id}`, {
          method: "PATCH",
          headers: { "If-Match": String(model.revision) },
          body: JSON.stringify(model),
        });
        s.setSoc(saved);
        s.setSocDirty(false);
        setMessage(
          `Committed revision ${saved.revision}. Topology validation only; simulation unverified.`,
        );
      } else
        setMessage(
          "Topology checks passed. Simulation and protocol behavior remain unverified.",
        );
    } catch (e) {
      if (e instanceof ApiError && e.code === "SOC_CONFIG_INVALID")
        s.setTopologyErrors(e.details as TopologyError[]);
      s.error(e);
    }
  }
  if (!model) return null;
  const edges = model.connections.map((e) => ({
    id: e.id,
    source: e.from.instance_id,
    sourceHandle: e.from.interface_id,
    target: e.to.instance_id,
    targetHandle: e.to.interface_id,
    type: "smoothstep",
    animated: false,
    style: {
      stroke: s.topologyErrors.some((x) => x.id === e.id)
        ? "#ed8c8c"
        : "#61bdab",
      strokeWidth: 2,
    },
  }));
  return (
    <div className="composer">
      <div className="composer-toolbar">
        <span className="tag neutral">TOPOLOGY EDITOR</span>
        <span className="muted">rev {model.revision}</span>
        {s.socDirty && <span className="tag amber">Unsaved changes</span>}
        <span className="flex-spacer" />
        <button
          className="small-button"
          onClick={() => {
            setPackageId(s.packages[0]?.id ?? "");
            setShowAdd(true);
          }}
        >
          <Icon name="plus" size={14} /> Instance
        </button>
        <button className="small-button" onClick={() => void validate()}>
          Validate
        </button>
        <button className="primary small" onClick={() => void validate(true)}>
          <Icon name="save" size={14} /> Commit topology
        </button>
      </div>
      <div className="graph-area">
        <ReactFlow<HardwareFlowNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode="dark"
          onNodeDragStop={(_, dragged) =>
            s.persist({
              graphPositions: Object.fromEntries(
                nodes.map((n) => [
                  n.id,
                  n.id === dragged.id ? dragged.position : n.position,
                ]),
              ),
            })
          }
          onNodesChange={(changes) =>
            setNodes((current) => applyNodeChanges(changes, current))
          }
          onConnect={connect}
          onNodesDelete={(removed) => {
            const ids = new Set(removed.map((n) => n.id));
            change({
              ...model,
              instances: model.instances.filter((i) => !ids.has(i.id)),
              address_regions: model.address_regions.filter(
                (r) => !ids.has(r.instance_id),
              ),
              connections: model.connections.filter(
                (c) =>
                  !ids.has(c.from.instance_id) && !ids.has(c.to.instance_id),
              ),
            });
          }}
          onEdgesDelete={(removed) =>
            change({
              ...model,
              connections: model.connections.filter(
                (c) => !removed.some((r) => r.id === c.id),
              ),
            })
          }
          fitView
          fitViewOptions={{ maxZoom: 1.1 }}
          minZoom={0.3}
          maxZoom={1.8}
        >
          <Background color="#26333e" gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap nodeColor="#24443f" maskColor="#11171ecc" />
        </ReactFlow>
        {!model.instances.length && (
          <div className="graph-onboarding">
            <Icon name="graph" size={38} />
            <h3>Give your design a topology.</h3>
            <p>
              Add packaged IP, review bus mappings,
              <br />
              then connect and validate.
            </p>
            <button
              className="secondary"
              onClick={() => {
                setPackageId(s.packages[0]?.id ?? "");
                setShowAdd(true);
              }}
            >
              Add first instance <Icon name="arrow" size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="memory-map">
        <div className="memory-heading">
          <strong>Memory map</strong>
          <span className="muted">
            {model.address_width}-bit · half-open ranges
          </span>
          <span className="flex-spacer" />
          <button
            className="text-button"
            disabled={!model.instances.length}
            onClick={() =>
              change({
                ...model,
                address_regions: [
                  ...model.address_regions,
                  {
                    id: `region-${model.address_regions.length}`,
                    instance_id: model.instances[0].id,
                    base: "0x40000000",
                    size: "0x1000",
                    alignment: "0x4",
                  },
                ],
              })
            }
          >
            <Icon name="plus" size={13} /> Add region
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>INSTANCE</th>
              <th>BASE ADDRESS</th>
              <th>SIZE</th>
              <th>STATUS</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {model.address_regions.map((r, index) => (
              <tr
                key={r.id}
                className={
                  s.topologyErrors.some((e) => e.id === r.id)
                    ? "invalid-region"
                    : ""
                }
              >
                <td>
                  <select
                    aria-label={`Region ${index} instance`}
                    value={r.instance_id}
                    onChange={(e) =>
                      change({
                        ...model,
                        address_regions: model.address_regions.map((x) =>
                          x.id === r.id
                            ? { ...x, instance_id: e.target.value }
                            : x,
                        ),
                      })
                    }
                  >
                    {model.instances.map((i) => (
                      <option key={i.id}>{i.id}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    aria-label={`Region ${index} base`}
                    value={r.base}
                    onChange={(e) =>
                      change({
                        ...model,
                        address_regions: model.address_regions.map((x) =>
                          x.id === r.id ? { ...x, base: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`Region ${index} size`}
                    value={r.size}
                    onChange={(e) =>
                      change({
                        ...model,
                        address_regions: model.address_regions.map((x) =>
                          x.id === r.id ? { ...x, size: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </td>
                <td>
                  <span className="region-status">
                    {s.topologyErrors.find((e) => e.id === r.id)?.code ??
                      "Draft"}
                  </span>
                </td>
                <td>
                  <button
                    className="icon-button"
                    title="Remove region"
                    onClick={() =>
                      change({
                        ...model,
                        address_regions: model.address_regions.filter(
                          (x) => x.id !== r.id,
                        ),
                      })
                    }
                  >
                    <Icon name="close" size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!model.address_regions.length && (
          <p className="muted map-empty">
            No address regions. Add a region for a mapped target.
          </p>
        )}
      </div>
      {(message || s.topologyErrors.length > 0) && (
        <div
          className={`topology-message ${s.topologyErrors.length ? "error" : ""}`}
          role="status"
        >
          {message}
          {s.topologyErrors.map((e, i) => (
            <div key={i}>
              <code>{e.id}</code> · {e.code}: {e.message}
            </div>
          ))}
        </div>
      )}
      {showAdd && (
        <div className="modal-overlay">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <div className="modal-title">
              <h2>Add IP instance</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowAdd(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <p className="muted">
              Mappings entered here are reviewed metadata. Protocol behavior is
              unverified.
            </p>
            <label>
              Instance ID
              <input
                aria-label="Instance ID"
                pattern="[a-zA-Z_][a-zA-Z0-9_-]*"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              IP package
              <select
                aria-label="IP package"
                value={packageId}
                required
                onChange={(e) => setPackageId(e.target.value)}
              >
                <option value="">Select a local package</option>
                {s.packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.status}
                  </option>
                ))}
              </select>
            </label>
            {!s.packages.length && (
              <p className="amber-text">
                Analyze and package RTL in the IP Registry first.
              </p>
            )}
            <div className="form-row">
              <label>
                Bus role
                <select
                  aria-label="Bus role"
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "initiator" | "target")
                  }
                >
                  <option value="target">Target</option>
                  <option value="initiator">Initiator</option>
                </select>
              </label>
              <label>
                Protocol
                <select
                  aria-label="Bus protocol"
                  value={protocol}
                  onChange={(e) =>
                    setProtocol(e.target.value as Bus["protocol"])
                  }
                >
                  {[
                    "AXI4-Lite",
                    "APB",
                    "TL-UL",
                    "TileLink",
                    "generic_tlm",
                    "pin",
                  ].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="muted">
              32-bit data · {model.address_width}-bit address · core clock 100
              MHz. These are chosen mapping values, not compiler inferences.
            </p>
            <div className="modal-footer">
              <button
                type="button"
                className="secondary"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </button>
              <button className="primary" disabled={!packageId}>
                Add instance
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
