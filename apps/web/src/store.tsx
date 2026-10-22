import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, post, terminal } from "./api";
import type {
  Project,
  Import,
  Source,
  Run,
  RunEvent,
  Selection,
  Package,
  Provider,
  Soc,
  TopologyError,
} from "./types";
import type { AnalyzeRequest, ImportRequest } from "./api-contracts";
import sample from "../../../reference/register_bank/rtl/register_bank.sv?raw";

type Workspace = {
  revision: number;
  layout: {
    dock?: unknown;
    importId?: string;
    sourceId?: string;
    runId?: string;
    graphPositions?: Record<string, { x: number; y: number }>;
  };
};
export function useStudioState() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [imports, setImports] = useState<Import[]>([]);
  const [currentImport, setCurrentImport] = useState<Import | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [soc, setSoc] = useState<Soc | null>(null);
  const [socDirty, setSocDirty] = useState(false);
  const [topologyErrors, setTopologyErrors] = useState<TopologyError[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [notice, setNotice] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const layoutRef = useRef<Workspace["layout"]>({});
  const projectRef = useRef<string | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const error = (e: unknown) =>
    setNotice(e instanceof Error ? e.message : String(e));

  async function loadProject(id: string) {
    clearTimeout(persistTimer.current);
    projectRef.current = id;
    setWorkspace(null);
    setSelection(null);
    setEvents([]);
    setRun(null);
    setContent("");
    setDraft("");
    const [p, files, jobs, topology, saved] = await Promise.all([
      api<Project>(`/projects/${id}`),
      api<Import[]>(`/projects/${id}/rtl-imports`),
      api<Run[]>(`/projects/${id}/runs`),
      api<Soc>(`/projects/${id}/soc-config`),
      api<Workspace>(`/projects/${id}/workspace`),
    ]);
    if (projectRef.current !== id) return;
    setProject(p);
    setImports(files);
    setRuns(jobs);
    setSoc(topology);
    setSocDirty(false);
    setTopologyErrors([]);
    revision.current = saved.revision;
    layoutRef.current = saved.layout;
    setWorkspace(saved);
    const item =
      files.find((f) => f.id === saved.layout.importId) ?? files[0] ?? null;
    setCurrentImport(item);
    setSource(
      item?.files.find((f) => f.id === saved.layout.sourceId) ??
        item?.files[0] ??
        null,
    );
    setRun(
      jobs.find(
        (r) => r.id === saved.layout.runId && r.import_id === item?.id,
      ) ??
        jobs.find((r) => r.import_id === item?.id) ??
        null,
    );
    localStorage.setItem("opensoc.project", id);
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      api("/health"),
      api<Project[]>("/projects"),
      api<Package[]>("/ip-registry"),
      api<Provider[]>("/cpu-providers"),
    ])
      .then(async ([, list, catalog, cpus]) => {
        if (!active) return;
        setConnected(true);
        setPackages(catalog);
        setProviders(cpus);
        const all = list.length
          ? list
          : [await post<Project>("/projects", { name: "My SoC workspace" })];
        if (!active) return;
        setProjects(all);
        await loadProject(
          all.find((p) => p.id === localStorage.getItem("opensoc.project"))
            ?.id ?? all[0].id,
        );
      })
      .catch(error);
    return () => {
      active = false;
      clearTimeout(persistTimer.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!source || !currentImport) {
      setContent("");
      setDraft("");
      return;
    }
    api<{ content: string }>(
      `/rtl-imports/${currentImport.id}/sources/${source.id}`,
    )
      .then((data) => {
        if (active) {
          setContent(data.content);
          setDraft(data.content);
        }
      })
      .catch(error);
    return () => {
      active = false;
    };
  }, [source?.id, currentImport?.id]);

  useEffect(() => {
    if (!run) {
      setEvents([]);
      return;
    }
    const id = run.id;
    let active = true,
      socket: WebSocket | undefined,
      reconnect: ReturnType<typeof setTimeout> | undefined;
    let cursor = 0;
    setEvents([]);
    const update = async () => {
      const value = await api<Run>(`/runs/${id}`);
      if (active) {
        setRun(value);
        setRuns((old) => [value, ...old.filter((r) => r.id !== id)]);
      }
      return value;
    };
    const connect = () => {
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/v1/runs/${id}/stream?after_seq=${cursor}`,
      );
      socket.onmessage = (event) => {
        if (!active) return;
        const item = JSON.parse(event.data) as RunEvent;
        if (item.seq <= cursor) return;
        cursor = item.seq;
        setEvents((old) => [...old, item].slice(-2000));
        if (item.kind === "job.state" || item.kind === "run.verdict")
          void update().catch(error);
      };
      socket.onclose = () => {
        if (active)
          void update()
            .then((value) => {
              if (active && !terminal(value.state))
                reconnect = setTimeout(connect, 600);
            })
            .catch(error);
      };
    };
    connect();
    return () => {
      active = false;
      clearTimeout(reconnect);
      socket?.close();
    };
  }, [run?.id]);

  function persist(partial: Workspace["layout"]) {
    layoutRef.current = { ...layoutRef.current, ...partial };
    const id = projectRef.current;
    if (!id || !workspace) return;
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const layout = structuredClone(layoutRef.current);
      saveQueue.current = saveQueue.current
        .then(async () => {
          if (projectRef.current !== id) return;
          const saved = await api<Workspace>(`/projects/${id}/workspace`, {
            method: "PUT",
            body: JSON.stringify({ revision: revision.current, layout }),
          });
          if (projectRef.current === id) revision.current = saved.revision;
        })
        .catch((e) => {
          error(e);
        });
    }, 400);
  }

  function selectSource(value: Source) {
    if (draft !== content && !window.confirm("Discard unsaved source edits?"))
      return;
    setSource(value);
    persist({ sourceId: value.id });
  }
  function openImport(item: Import) {
    setCurrentImport(item);
    setSource(item.files[0] ?? null);
    setSelection(null);
    const job = runs.find((r) => r.import_id === item.id) ?? null;
    setRun(job);
    persist({ importId: item.id, sourceId: item.files[0]?.id, runId: job?.id });
  }
  async function importFiles(
    files: { path: string; content: string }[],
    license = "NOASSERTION",
    redistribution = "review_required",
    parentImportId?: string,
  ) {
    if (!project) return;
    setBusy(true);
    try {
      const request: ImportRequest = {
        files,
        license_expression: license,
        redistribution: redistribution as ImportRequest["redistribution"],
        parent_import_id: parentImportId,
      };
      const item = await post<Import>(
        `/projects/${project.id}/rtl-imports`,
        request,
      );
      setImports((old) => [item, ...old]);
      openImport(item);
      setNotice(
        `Imported ${files.length} source file(s). Snapshot ${item.snapshot_sha256.slice(0, 12)}.`,
      );
      return item;
    } finally {
      setBusy(false);
    }
  }
  async function saveSource() {
    if (!source || !currentImport) return;
    const files = await Promise.all(
      currentImport.files.map(async (f) => ({
        path: f.path,
        content:
          f.id === source.id
            ? draft
            : (
                await api<{ content: string }>(
                  `/rtl-imports/${currentImport.id}/sources/${f.id}`,
                )
              ).content,
      })),
    );
    await importFiles(
      files,
      currentImport.rights.license_expression,
      currentImport.rights.redistribution,
      currentImport.id,
    );
    setNotice(
      "Saved as a new immutable source snapshot. Analyze again to update evidence.",
    );
  }
  async function analyze(top?: string) {
    if (!currentImport || draft !== content) {
      setNotice("Save source changes before analysis.");
      return;
    }
    const request: AnalyzeRequest = { top: top || null };
    const job = await post<Run>(
      `/rtl-imports/${currentImport.id}/analyze`,
      request,
    );
    setRuns((old) => [job, ...old]);
    setRun(job);
    persist({ runId: job.id });
  }
  async function createProject(name: string) {
    const p = await post<Project>("/projects", { name });
    setProjects((old) => [...old, p]);
    await loadProject(p.id);
  }
  function select(
    location: { file: string; line: number; column: number },
    hierarchyPath?: string,
  ) {
    const file = currentImport?.files.find((f) => f.path === location.file);
    if (file) setSource(file);
    setSelection({
      schemaVersion: "1.0",
      projectId: project?.id ?? "",
      runId: run?.id,
      originId: "hierarchy",
      evidenceLevel: file ? "EXACT" : "UNAVAILABLE",
      hierarchyPath,
      sourceLocation: file
        ? { fileId: file.id, line: location.line, column: location.column }
        : undefined,
    });
  }
  return {
    projects,
    project,
    imports,
    currentImport,
    source,
    content,
    draft,
    setDraft,
    runs,
    run,
    setRun,
    events,
    packages,
    setPackages,
    providers,
    soc,
    setSoc,
    socDirty,
    setSocDirty,
    topologyErrors,
    setTopologyErrors,
    selection,
    workspace,
    notice,
    setNotice,
    connected,
    busy,
    error,
    loadProject,
    createProject,
    selectSource,
    openImport,
    importFiles,
    saveSource,
    analyze,
    select,
    persist,
    loadSample: () =>
      importFiles([{ path: "rtl/register_bank.sv", content: sample }]),
  };
}
type StudioState = ReturnType<typeof useStudioState>;
const Context = createContext<StudioState | null>(null);
export function StudioProvider({ children }: { children: ReactNode }) {
  const state = useStudioState();
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useStudio() {
  const s = useContext(Context);
  if (!s) throw Error("Workbench context missing");
  return s;
}
