import { useEffect, useRef, useState } from "react";
import { api, post, terminal } from "./api";
import { useStudio } from "./store";
import type { RuntimeRequest } from "./api-contracts";

type Stage = { id: string; state: string; details?: Record<string, unknown> };
type RuntimeRun = {
  id: string;
  profile_id: string;
  scenario: string;
  state: string;
  reason?: string;
  stages: Stage[];
  result?: {
    error?: string;
    artifacts: Record<string, { sha256: string; size: number }>;
    checks: Record<string, unknown>;
  };
};
type Capabilities = {
  profiles: {
    id: RuntimeRequest["profile_id"];
    description: string;
    available: boolean;
    status: string;
  }[];
  toolchain: { tools: Record<string, unknown> } | null;
  isolation: string;
};
type Wave = {
  reader: string;
  tick_fs: string;
  start: string;
  end: string;
  signals: { id: string; name: string; width: number }[];
  window: {
    id: string;
    name: string;
    width: number;
    initial: string | null;
    changes: [string, string][];
    truncated: boolean;
  }[];
};

export function RuntimePanel() {
  const studio = useStudio();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [profile, setProfile] =
    useState<RuntimeRequest["profile_id"]>("picorv32_verilator");
  const [scenario, setScenario] =
    useState<RuntimeRequest["scenario"]>("baseline");
  const [runs, setRuns] = useState<RuntimeRun[]>([]);
  const [selected, setSelected] = useState<RuntimeRun | null>(null);
  const activeRun = useRef<string | null>(null);
  activeRun.current = selected?.id ?? null;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wave, setWave] = useState<Wave | null>(null);
  const [start, setStart] = useState("0"),
    [end, setEnd] = useState("auto");
  const [signalId, setSignalId] = useState("");
  const [cursor, setCursor] = useState("0");
  useEffect(() => {
    void api<Capabilities>("/runtime/capabilities")
      .then(setCaps)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!studio.project) return;
    let active = true;
    async function refresh() {
      try {
        const list = await api<RuntimeRun[]>(
          `/runtime/runs?project_id=${studio.project!.id}`,
        );
        if (active) {
          setRuns(list);
          setSelected(
            (previous) =>
              list.find((r) => r.id === previous?.id) ??
              previous ??
              list[0] ??
              null,
          );
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    }
    setSelected(null);
    setWave(null);
    void refresh();
    const timer = setInterval(() => void refresh(), 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [studio.project?.id]);
  async function run() {
    if (!studio.project) return;
    setBusy(true);
    setError("");
    setWave(null);
    setSignalId("");
    try {
      const body: RuntimeRequest = {
        project_id: studio.project.id,
        profile_id: profile,
        scenario,
      };
      const item = await post<RuntimeRun>("/runtime/runs", body);
      setSelected(item);
      setRuns((list) => [item, ...list]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const artifacts = Object.entries(selected?.result?.artifacts ?? {});
  const waveform = artifacts.find(([path]) => /\.(vcd|fst)$/.test(path));
  async function loadWave() {
    if (!selected || !waveform) return;
    const requestedRun = selected.id;
    setError("");
    try {
      const data = await api<Wave>(
        `/runtime/runs/${selected.id}/waveform/${waveform[1].sha256}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&ids=${signalId}`,
      );
      if (activeRun.current === requestedRun) {
        setWave(data);
        setCursor(data.start);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const number = (tick: string) =>
    (Number(BigInt(tick) - BigInt(wave!.start)) /
      Number(BigInt(wave!.end) - BigInt(wave!.start))) *
    900;
  return (
    <div className="panel-scroll runtime-panel reference-evidence">
      <h2>Engine Runtime</h2>
      <p>
        Build and simulate reviewed reference systems. Each run keeps stage
        verdicts, compiler logs, firmware and trace hashes.
      </p>
      <div className="runtime-controls">
        <label>
          Workflow
          <select
            aria-label="Runtime workflow"
            value={profile}
            onChange={(e) =>
              setProfile(e.target.value as RuntimeRequest["profile_id"])
            }
          >
            {caps?.profiles.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.available}>
                {p.id} · {p.status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Scenario
          <select
            aria-label="Runtime scenario"
            value={scenario}
            onChange={(e) =>
              setScenario(e.target.value as RuntimeRequest["scenario"])
            }
          >
            <option value="baseline">Baseline</option>
            <option
              value="backpressure"
              disabled={
                ![
                  "picorv32_icarus",
                  "picorv32_verilator",
                  "systemc_tlm",
                  "systemc_verilated",
                ].includes(profile)
              }
            >
              Backpressure / delay
            </option>
            <option value="negative_control">Negative control</option>
          </select>
        </label>
        <button
          className="primary"
          onClick={() => void run()}
          disabled={
            busy ||
            !studio.project ||
            !caps?.profiles.find((p) => p.id === profile)?.available
          }
        >
          Build &amp; Run
        </button>
      </div>
      <p>{caps?.profiles.find((p) => p.id === profile)?.description}</p>
      {error && <p role="alert">{error}</p>}
      <label>
        Run history
        <select
          aria-label="Runtime run history"
          value={selected?.id ?? ""}
          onChange={(e) => {
            setSelected(runs.find((r) => r.id === e.target.value) ?? null);
            setWave(null);
            setSignalId("");
          }}
        >
          <option value="" disabled>
            Select run
          </option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.profile_id} / {r.scenario} / {r.state} / {r.id}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <>
          <p role="status" data-testid="runtime-state">
            {selected.state}
          </p>
          {!terminal(selected.state) && (
            <button
              onClick={() =>
                void post(`/runtime/runs/${selected.id}/cancel`).catch((e) =>
                  setError(e.message),
                )
              }
            >
              Cancel runtime
            </button>
          )}
          {selected.reason && <p>{selected.reason}</p>}
          {selected.result?.error && (
            <p role="alert">{selected.result.error}</p>
          )}
          <table aria-label="Runtime stages">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Verdict</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {selected.stages.map((stage) => (
                <tr key={stage.id}>
                  <td>{stage.id}</td>
                  <td>{stage.state}</td>
                  <td>
                    <code>{JSON.stringify(stage.details ?? {})}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <details>
            <summary>Toolchain inventory</summary>
            <pre>{JSON.stringify(caps?.toolchain, null, 2)}</pre>
          </details>
          {waveform && (
            <div className="runtime-wave">
              <h3>Waveform · Wellen</h3>
              <div className="runtime-controls">
                <label>
                  Start tick
                  <input
                    aria-label="Wave start tick"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </label>
                <label>
                  End tick
                  <input
                    aria-label="Wave end tick"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </label>
                <button onClick={() => void loadWave()}>
                  Load waveform window
                </button>
              </div>
              {wave && (
                <>
                  <p>
                    {wave.reader} · 1 tick = {wave.tick_fs} fs · origin
                    simulation_zero · trace mapping exact; source mapping
                    unavailable
                  </p>
                  <label>
                    Signal
                    <select
                      aria-label="Wave signal"
                      value={signalId}
                      onChange={(e) => setSignalId(e.target.value)}
                    >
                      <option value="">Default signals</option>
                      {wave.signals.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} [{s.width}]
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    Cursor tick:{" "}
                    <output aria-label="Wave cursor tick">{cursor}</output>
                  </p>
                  <svg
                    role="img"
                    aria-label="Actual waveform values"
                    viewBox={`0 0 1100 ${wave.window.length * 55 + 20}`}
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      const ratio = Math.max(
                        0,
                        Math.min(
                          1,
                          (((event.clientX - rect.left) / rect.width) * 1100) /
                            900,
                        ),
                      );
                      const delta = BigInt(wave.end) - BigInt(wave.start);
                      setCursor(
                        String(
                          BigInt(wave.start) +
                            (delta * BigInt(Math.round(ratio * 1000000))) /
                              1000000n,
                        ),
                      );
                    }}
                  >
                    {wave.window.map((s, index) => {
                      const y = index * 55 + 20;
                      const points: [string, string | null][] = [
                        [wave.start, s.initial],
                        ...s.changes,
                      ];
                      let d = "";
                      points.forEach(([tick, value], i) => {
                        const x = number(tick);
                        const level =
                          value === "1" ? y : value === "0" ? y + 20 : y + 10;
                        if (i === 0) d = `M ${x} ${level}`;
                        else d += ` H ${x} V ${level}`;
                      });
                      d += ` H ${s.truncated && s.changes.length ? number(s.changes[s.changes.length - 1][0]) : 900}`;
                      return (
                        <g key={s.id}>
                          <title>
                            {s.name} · {s.id}
                          </title>
                          <path
                            d={d}
                            fill="none"
                            stroke="#8cddc3"
                            strokeWidth="1.5"
                          />
                          <text x="910" y={y + 14} fill="#9bafbd" fontSize="11">
                            {s.name.split(".").slice(-1)[0]}
                            {s.truncated ? " (truncated)" : ""}
                          </text>
                          {s.width > 1 &&
                            s.changes.map(([tick]) => (
                              <line
                                key={"edge-" + tick}
                                x1={number(tick)}
                                x2={number(tick)}
                                y1={y + 5}
                                y2={y + 15}
                                stroke="#8cddc3"
                              />
                            ))}
                          {s.width > 1 &&
                            s.changes
                              .filter(
                                ([tick], index, changes) =>
                                  index === 0 ||
                                  number(tick) - number(changes[index - 1][0]) >
                                    65 ||
                                  Math.floor(number(tick) / 90) !==
                                    Math.floor(
                                      number(changes[index - 1][0]) / 90,
                                    ),
                              )
                              .filter(([tick]) => number(tick) < 835)
                              .map(([tick, value]) => (
                                <text
                                  key={tick}
                                  x={number(tick) + 3}
                                  y={y + 9}
                                  fill="#d6e5ed"
                                  fontSize="8"
                                >
                                  {value.length > 12
                                    ? value.slice(0, 5) + "…" + value.slice(-5)
                                    : value}
                                </text>
                              ))}
                        </g>
                      );
                    })}
                    <line
                      x1={number(cursor)}
                      x2={number(cursor)}
                      y1="0"
                      y2={wave.window.length * 55 + 20}
                      stroke="#e6ba79"
                    />
                  </svg>
                  <table aria-label="Wave cursor values">
                    <thead>
                      <tr>
                        <th>Signal</th>
                        <th>Value at cursor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wave.window.map((signal) => {
                        let value = signal.initial;
                        for (const [tick, next] of signal.changes) {
                          if (BigInt(tick) > BigInt(cursor)) break;
                          value = next;
                        }
                        const outside =
                          BigInt(cursor) < BigInt(wave.start) ||
                          BigInt(cursor) > BigInt(wave.end) ||
                          (signal.truncated &&
                            signal.changes.length > 0 &&
                            BigInt(cursor) >
                              BigInt(
                                signal.changes[signal.changes.length - 1][0],
                              ));
                        return (
                          <tr key={signal.id}>
                            <td>{signal.name}</td>
                            <td>
                              {outside
                                ? "Outside returned window; narrow the time range"
                                : (value ??
                                  "Unavailable before first recorded sample")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
          <details>
            <summary>Artifacts and logs ({artifacts.length})</summary>
            <ul>
              {artifacts.map(([path, item]) => (
                <li key={path}>
                  <a
                    href={`/api/v1/runtime/runs/${selected.id}/artifacts/${item.sha256}`}
                    download
                  >
                    {path.split("/").slice(-2).join("/")}
                  </a>{" "}
                  · {item.size.toLocaleString()} bytes
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      <p>
        {caps?.isolation} Imported user RTL is not executed by these reference
        workflows.
      </p>
    </div>
  );
}
