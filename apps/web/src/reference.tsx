import { useEffect, useState } from "react";
import { api } from "./api";

type Report = {
  evidence_id: string;
  status: string;
  source_revision: string;
  run_at: string;
  simulator: string;
  cases: { id: string; status: string; cycles?: number; log: string }[];
  downloads: Record<string, { sha256: string; size?: number }>;
};

export function ReferencePanel() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  function refresh() {
    setError("");
    void api<Report>("/reference-regression")
      .then(setReport)
      .catch((e: Error) => {
        setReport(null);
        setError(e.message);
      });
  }
  useEffect(refresh, []);
  const link = (path: string) =>
    report
      ? `/api/v1/reference-regression/${report.evidence_id}/artifacts/${report.downloads[path]?.sha256}`
      : "";
  return (
    <div className="panel-scroll reference-evidence">
      <h2>Actual RTL reference regression</h2>
      <p>
        PicoRV32 CPU + AXI memory + 128 KiB RAM + MMIO output and pass register.
        Results come from the local Icarus run.
      </p>
      <button className="secondary" onClick={refresh}>
        Refresh reference evidence
      </button>
      {error && <p role="status">{error}</p>}
      {report && (
        <>
          <p>
            <strong>Regression {report.status}</strong> · {report.simulator} ·{" "}
            {new Date(report.run_at).toLocaleString()}
          </p>
          <p>
            Source revision: <code>{report.source_revision}</code>
          </p>
          <table
            aria-label="Actual RTL regression cases"
            style={{ width: "100%", textAlign: "left" }}
          >
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Verdict</th>
                <th>Cycles</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {report.cases.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.status}</td>
                  <td>{c.cycles ?? "—"}</td>
                  <td>
                    <a href={link(c.log)} download>
                      Download log
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Recorded artifacts</h3>
          <ul>
            {Object.entries(report.downloads)
              .filter(([path]) => /\.(vcd|elf|jsonl|trace)$/.test(path))
              .map(([path, item]) => (
                <li key={path}>
                  <a href={link(path)} download>
                    {path.split(/[\\/]/).slice(-2).join("/")}
                  </a>{" "}
                  {item.size ? `(${item.size.toLocaleString()} bytes)` : ""}
                </li>
              ))}
          </ul>
        </>
      )}
      <p>
        Negative control succeeds when corrupted firmware is rejected. This
        reference is experimental; Ibex, gem5, arbitrary RTL execution and
        embedded waveform navigation still require their own acceptance
        evidence.
      </p>
    </div>
  );
}
