import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DockviewReact,
  type DockviewReadyEvent,
  type DockviewApi,
  type SerializedDockview,
} from "dockview-react";
import { StudioProvider, useStudio } from "./store";
import {
  ExplorerPanel,
  InspectorPanel,
  ConsolePanel,
  RegistryPanel,
  WaveformPanel,
  FirmwarePanel,
} from "./panels";
import { ComposerPanel } from "./composer";
import { ReferencePanel } from "./reference";
import { RuntimePanel } from "./runtime";
import { Icon } from "./icons";
import { terminal } from "./api";
const Editor = lazy(() =>
  import("./editor").then((module) => ({ default: module.EditorPanel })),
);
function EditorPanel() {
  return (
    <Suspense
      fallback={<div className="connecting">Loading source editor…</div>}
    >
      <Editor />
    </Suspense>
  );
}
const panels = {
  explorer: ExplorerPanel,
  editor: EditorPanel,
  inspector: InspectorPanel,
  console: ConsolePanel,
  composer: ComposerPanel,
  registry: RegistryPanel,
  waveform: WaveformPanel,
  firmware: FirmwarePanel,
  reference: ReferencePanel,
  runtime: RuntimePanel,
};

function Workbench() {
  const s = useStudio();
  const dock = useRef<DockviewApi | null>(null);
  const persist = useRef(s.persist);
  persist.current = s.persist;
  const [dialog, setDialog] = useState<
    "import" | "project" | "commands" | null
  >(null);
  const [projectName, setProjectName] = useState("");
  const [top, setTop] = useState("");
  const [license, setLicense] = useState("NOASSERTION");
  const [files, setFiles] = useState<{ path: string; content: string }[]>([]);
  const [query, setQuery] = useState("");
  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      const api = event.api;
      dock.current = api;
      if (s.workspace?.layout.dock) {
        try {
          api.fromJSON(s.workspace.layout.dock as SerializedDockview);
        } catch {
          api.clear();
        }
      }
      if (!api.panels.length) {
        api.addPanel({
          id: "editor",
          component: "editor",
          title: "Source editor",
        });
        api.addPanel({
          id: "composer",
          component: "composer",
          title: "SoC Composer",
          position: { referencePanel: "editor", direction: "within" },
        });
        api.addPanel({
          id: "registry",
          component: "registry",
          title: "IP Registry",
          position: { referencePanel: "editor", direction: "within" },
        });
        api.addPanel({
          id: "firmware",
          component: "firmware",
          title: "Firmware",
          position: { referencePanel: "editor", direction: "within" },
        });
        api.addPanel({
          id: "waveform",
          component: "waveform",
          title: "Waveforms",
          position: { referencePanel: "editor", direction: "within" },
        });
        api.addPanel({
          id: "explorer",
          component: "explorer",
          title: "Explorer",
          initialWidth: 255,
          position: { referencePanel: "editor", direction: "left" },
        });
        api.addPanel({
          id: "inspector",
          component: "inspector",
          title: "Inspector",
          initialWidth: 290,
          position: { referencePanel: "editor", direction: "right" },
        });
        api.addPanel({
          id: "console",
          component: "console",
          title: "Build & diagnostics",
          initialHeight: 210,
          position: { referencePanel: "editor", direction: "below" },
        });
        api.getPanel("editor")?.api.setActive();
      }
      api.onDidLayoutChange(() => persist.current({ dock: api.toJSON() }));
    },
    [s.project?.id, s.workspace],
  );

  function openPanel(id: string) {
    const existing = dock.current?.getPanel(id);
    if (existing) existing.api.setActive();
    else
      dock.current?.addPanel({
        id,
        component: id,
        position:
          ["reference", "runtime"].includes(id) &&
          dock.current?.getPanel("editor")
            ? { referencePanel: "editor", direction: "within" }
            : undefined,
        title:
          {
            editor: "Source editor",
            composer: "SoC Composer",
            registry: "IP Registry",
            waveform: "Waveforms",
            firmware: "Firmware",
            reference: "RTL Regression",
            runtime: "Engine Runtime",
            explorer: "Explorer",
            inspector: "Inspector",
            console: "Build & diagnostics",
          }[id] ?? id,
      });
  }
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setDialog("commands");
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void s.saveSource().catch(s.error);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [s.saveSource]);
  const commands = [
    { label: "Import RTL sources", action: () => setDialog("import") },
    { label: "Create project", action: () => setDialog("project") },
    ...[
      "editor",
      "composer",
      "registry",
      "firmware",
      "waveform",
      "reference",
      "runtime",
      "explorer",
      "inspector",
      "console",
    ].map((id) => ({
      label: `Open ${id}`,
      action: () => {
        openPanel(id);
        setDialog(null);
      },
    })),
    {
      label: "Analyze current RTL",
      action: () => {
        void s.analyze(top).catch(s.error);
        setDialog(null);
      },
    },
  ];
  const working = !!s.run && !terminal(s.run.state);
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">
            <Icon name="chip" size={23} />
          </span>
          <strong>
            OpenSoC<span>Studio</span>
          </strong>
          <span className="version">V1.0 DEV</span>
        </div>
        <span className="topbar-divider" />
        <div className="project-picker">
          <Icon name="folder" size={15} />
          <select
            aria-label="Current project"
            value={s.project?.id ?? ""}
            onChange={(e) => void s.loadProject(e.target.value).catch(s.error)}
          >
            {s.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            className="icon-button"
            aria-label="Create project"
            onClick={() => setDialog("project")}
          >
            <Icon name="plus" size={14} />
          </button>
        </div>
        <span className="flex-spacer" />
        <button
          className="command-button"
          onClick={() => setDialog("commands")}
        >
          <Icon name="search" size={14} />
          <span>Find a command…</span>
          <kbd>Ctrl K</kbd>
        </button>
        <span className="local-indicator">
          <span className={`dot ${s.connected ? "" : "offline"}`} />
          {s.connected ? "LOCAL" : "CONNECTING"}
        </span>
        <div className="avatar">OS</div>
      </header>
      <div className="main-toolbar">
        <div className="toolbar-crumb">
          <span>WORKSPACE</span>
          <Icon name="chevron" size={12} />
          <strong>{s.project?.name ?? "Connecting to backend…"}</strong>
        </div>
        <span className="flex-spacer" />
        <span className="toolbar-meta">
          <span className="tag neutral">AI OFF</span>
          <span>RTL analysis</span>
        </span>
        <input
          className="top-input"
          aria-label="Top module"
          placeholder="Top module (auto)"
          value={top}
          onChange={(e) => setTop(e.target.value)}
        />
        <button className="secondary small" onClick={() => setDialog("import")}>
          <Icon name="plus" size={14} /> Import RTL
        </button>
        <button
          className="primary small"
          disabled={!s.currentImport || working || s.busy}
          onClick={() => {
            openPanel("console");
            void s.analyze(top).catch(s.error);
          }}
        >
          <Icon name="run" size={14} />
          {working ? "Analyzing…" : "Analyze RTL"}
        </button>
      </div>
      <main className="workbench-row">
        <nav className="activity-bar" aria-label="Workbench views">
          {[
            ["explorer", "files", "Explorer"],
            ["composer", "graph", "SoC Composer"],
            ["registry", "library", "IP Registry"],
            ["waveform", "wave", "Waveforms"],
            ["reference", "run", "RTL Regression"],
            ["runtime", "chip", "Engine Runtime"],
            ["console", "terminal", "Output"],
          ].map(([id, icon, title]) => (
            <button
              key={id}
              title={title}
              aria-label={`Open ${title}`}
              onClick={() => openPanel(id)}
            >
              <Icon name={icon} size={21} />
            </button>
          ))}
          <span className="flex-spacer" />
          <button
            title="Restore panels"
            onClick={() => {
              for (const id of ["explorer", "editor", "inspector", "console"])
                openPanel(id);
            }}
          >
            <Icon name="settings" size={20} />
          </button>
        </nav>
        <div className="dock-host">
          {s.workspace && s.project ? (
            <DockviewReact
              key={s.project.id}
              className="dockview-theme-abyss"
              components={panels}
              onReady={onReady}
            />
          ) : (
            <div className="connecting">
              <span className="dot" /> Connecting to local backend…
              {s.notice && <p>{s.notice}</p>}
            </div>
          )}
        </div>
      </main>
      <footer className="statusbar">
        <span>
          <span className={`dot ${s.connected ? "" : "offline"}`} />
          {s.connected ? "Backend connected" : "Backend unavailable"}
        </span>
        <i />
        <span>
          {s.run?.result
            ? `slang ${s.run.result.tool_version}`
            : "Compiler ready"}
        </span>
        <span className="flex-spacer" />
        <span>{s.selection?.hierarchyPath ?? "No selection"}</span>
        <i />
        <span>Project simulation: unavailable</span>
        <i />
        <span>Local single user</span>
      </footer>
      {s.notice && (
        <div className="toast" role="status">
          <Icon name="warning" size={17} />
          <span>{s.notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => s.setNotice("")}
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      {dialog && (
        <div className="modal-overlay" onClick={() => setDialog(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title">
              <h2>
                {dialog === "import"
                  ? "Import RTL sources"
                  : dialog === "project"
                    ? "Create project"
                    : "Command palette"}
              </h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setDialog(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            {dialog === "project" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void s
                    .createProject(projectName)
                    .then(() => setDialog(null))
                    .catch(s.error);
                }}
              >
                <label>
                  Project name
                  <input
                    autoFocus
                    required
                    maxLength={100}
                    aria-label="Project name"
                    placeholder="e.g. Sensor controller"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </label>
                <p className="muted">
                  Stored locally in SQLite. AI and outbound services are off.
                </p>
                <div className="modal-footer">
                  <button className="primary" type="submit">
                    Create workspace
                  </button>
                </div>
              </form>
            )}
            {dialog === "import" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void s
                    .importFiles(files, license)
                    .then(() => {
                      setDialog(null);
                      setFiles([]);
                      openPanel("editor");
                    })
                    .catch(s.error);
                }}
              >
                <p className="muted">
                  Choose a self-contained SystemVerilog fileset. Sources are
                  stored as immutable snapshots; no build scripts are executed.
                </p>
                <label className="file-drop">
                  <Icon name="files" size={30} />
                  <strong>
                    {files.length
                      ? `${files.length} source file(s) selected`
                      : "Choose RTL files"}
                  </strong>
                  <span>.sv · .v · .svh · .vh / up to 4 MB total</span>
                  <input
                    aria-label="RTL source files"
                    type="file"
                    multiple
                    accept=".sv,.v,.svh,.vh"
                    onChange={(e) => {
                      const selected = Array.from(e.target.files ?? []);
                      if (
                        selected.length > 128 ||
                        selected.reduce((n, f) => n + f.size, 0) > 4000000
                      ) {
                        s.setNotice("Import limit: 128 files and 4 MB.");
                        return;
                      }
                      void Promise.all(
                        selected.map(async (f) => ({
                          path: f.webkitRelativePath || f.name,
                          content: await f.text(),
                        })),
                      )
                        .then(setFiles)
                        .catch(s.error);
                    }}
                  />
                </label>
                <div className="selected-files">
                  {files.map((f) => (
                    <code key={f.path}>{f.path}</code>
                  ))}
                </div>
                <label>
                  Source license expression
                  <input
                    aria-label="Source license expression"
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                  />
                </label>
                <p className="muted">
                  Enter known source rights, or leave NOASSERTION for review.
                  Import does not grant redistribution permission. Includes
                  require an isolated parser flow and are currently unavailable.
                </p>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setDialog(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary"
                    disabled={!files.length || s.busy}
                  >
                    Import snapshot
                  </button>
                </div>
              </form>
            )}
            {dialog === "commands" && (
              <>
                <input
                  autoFocus
                  aria-label="Search commands"
                  placeholder="Search commands…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="command-list">
                  {commands
                    .filter((c) =>
                      c.label.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((c) => (
                      <button key={c.label} onClick={c.action}>
                        {c.label}
                        <Icon name="arrow" size={14} />
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default function App() {
  return (
    <StudioProvider>
      <Workbench />
    </StudioProvider>
  );
}
