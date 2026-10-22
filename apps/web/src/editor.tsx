import { useEffect, useRef } from "react";
import { useStudio } from "./store";
import * as monaco from "monaco-editor/editor/editor.api.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import { Icon } from "./icons";
(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};
monaco.languages.register({ id: "systemverilog" });
monaco.languages.setMonarchTokensProvider("systemverilog", {
  keywords: [
    "module",
    "endmodule",
    "input",
    "output",
    "inout",
    "logic",
    "wire",
    "reg",
    "parameter",
    "localparam",
    "int",
    "always_ff",
    "always_comb",
    "always",
    "begin",
    "end",
    "if",
    "else",
    "assign",
    "posedge",
    "negedge",
    "generate",
    "endgenerate",
    "case",
    "endcase",
    "default",
    "for",
  ],
  tokenizer: {
    root: [
      [/\/\/.*$/, "comment"],
      [/\/\*/, "comment", "@comment"],
      [
        /[a-zA-Z_][\w$]*/,
        { cases: { "@keywords": "keyword", "@default": "identifier" } },
      ],
      [/\d+'[sS]?[bBoOdDhH][0-9a-fA-F_xXzZ?]+|\d+/, "number"],
      [/"[^"\n]*"/, "string"],
      [/[{}()[\]]/, "@brackets"],
    ],
    comment: [
      [/[^/*]+/, "comment"],
      [/\*\//, "comment", "@pop"],
      [/[/*]/, "comment"],
    ],
  },
});
monaco.editor.defineTheme("opensoc", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "c4a7e7" },
    { token: "comment", foreground: "60766b" },
    { token: "number", foreground: "e5bd85" },
    { token: "identifier", foreground: "c9d5df" },
  ],
  colors: {
    "editor.background": "#11171e",
    "editorLineNumber.foreground": "#455463",
    "editorLineNumber.activeForeground": "#94b5b1",
    "editor.lineHighlightBackground": "#18232b",
    "editorCursor.foreground": "#6fdfc1",
    "editor.selectionBackground": "#27443f",
  },
});

export function EditorPanel() {
  const s = useStudio();
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const setDraft = useRef(s.setDraft);
  setDraft.current = s.setDraft;
  useEffect(() => {
    if (!host.current || !s.source) return;
    const instance = monaco.editor.create(host.current, {
      value: s.draft,
      language: "systemverilog",
      theme: "opensoc",
      automaticLayout: true,
      fontFamily: 'Consolas, "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 23,
      minimap: { enabled: false },
      padding: { top: 20 },
      scrollBeyondLastLine: false,
      renderLineHighlight: "line",
      bracketPairColorization: { enabled: true },
    });
    editor.current = instance;
    const listener = instance.onDidChangeModelContent(() =>
      setDraft.current(instance.getValue()),
    );
    return () => {
      listener.dispose();
      instance.getModel()?.dispose();
      instance.dispose();
      editor.current = null;
    };
  }, [s.source?.id]);
  useEffect(() => {
    if (editor.current && editor.current.getValue() !== s.draft)
      editor.current.setValue(s.draft);
  }, [s.draft]);
  useEffect(() => {
    const loc = s.selection?.sourceLocation;
    if (!loc || loc.fileId !== s.source?.id || !editor.current) return;
    editor.current.revealLineInCenter(loc.line);
    editor.current.setPosition({
      lineNumber: loc.line,
      column: loc.column ?? 1,
    });
    editor.current.focus();
  }, [s.selection, s.source?.id]);
  useEffect(() => {
    const model = editor.current?.getModel();
    if (!model) return;
    const diagnostics =
      s.run?.result?.diagnostics.filter(
        (d) => d.file === s.source?.path && d.line > 0,
      ) ?? [];
    monaco.editor.setModelMarkers(
      model,
      "slang",
      diagnostics.map((d) => ({
        startLineNumber: d.line,
        startColumn: Math.max(d.column, 1),
        endLineNumber: d.line,
        endColumn: Math.max(d.column, 1) + 1,
        message: d.message,
        severity:
          d.severity === "error"
            ? monaco.MarkerSeverity.Error
            : monaco.MarkerSeverity.Warning,
      })),
    );
  }, [s.run?.result, s.source?.id, s.content]);
  if (!s.source)
    return (
      <div className="welcome">
        <div className="welcome-eyebrow">
          <span className="dot" /> THE LOCAL-FIRST RTL WORKBENCH
        </div>
        <div className="welcome-chip">
          <Icon name="chip" size={58} />
        </div>
        <h1>
          From RTL to
          <br />
          <span>a clearer design.</span>
        </h1>
        <p>
          Import your sources. Explore the hierarchy.
          <br />
          Build a reusable hardware workspace.
        </p>
        <button
          className="primary"
          onClick={() => void s.loadSample().catch(s.error)}
        >
          <Icon name="plus" size={16} /> Open register example
        </button>
        <div className="welcome-note">
          Actual SystemVerilog source · analyzed locally · AI off
        </div>
        <div className="welcome-steps">
          <div>
            <b>01</b>
            <strong>Import</strong>
            <span>Immutable source snapshots</span>
          </div>
          <div>
            <b>02</b>
            <strong>Analyze</strong>
            <span>Compiler-derived hierarchy</span>
          </div>
          <div>
            <b>03</b>
            <strong>Assemble</strong>
            <span>Validated topology changes</span>
          </div>
        </div>
      </div>
    );
  return (
    <div className="editor-panel">
      <div className="editor-breadcrumb">
        <span>{s.project?.name}</span>
        <Icon name="chevron" size={11} />
        <span>{s.source.path}</span>
        <span className="flex-spacer" />
        {s.draft !== s.content && (
          <>
            <span className="tag amber">Unsaved</span>
            <button
              className="small-button"
              onClick={() => void s.saveSource().catch(s.error)}
            >
              <Icon name="save" size={13} /> Save snapshot
            </button>
          </>
        )}
        <span className="tag neutral">SystemVerilog</span>
      </div>
      <div className="monaco-host" ref={host} />
      <div className="editor-foot">
        <span>SHA256 {s.source.sha256.slice(0, 16)}</span>
        <span>
          UTF-8 <i /> {s.source.size} bytes <i /> Source revision preserved
        </span>
      </div>
    </div>
  );
}
