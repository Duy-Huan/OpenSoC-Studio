import type { CSSProperties } from "react";
const paths: Record<string, string> = {
  chip: "M8 3v3m4-3v3m4-3v3M8 18v3m4-3v3m4-3v3M3 8h3m-3 4h3m-3 4h3m12-8h3m-3 4h3m-3 4h3M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z",
  files: "M8 3h8l4 4v13H8V3Zm8 0v5h4M4 7v14h12",
  graph: "M8 5h8v5H8V5Zm-4 13h6v-5H4v5Zm10 0h6v-5h-6v5ZM12 10v2M7 13v-1h10v1",
  wave: "M3 16h4V7h5v9h5V7h4",
  library: "M4 4h4v16H4V4Zm6 0h4v16h-4V4Zm6 1 4-1 3 15-4 1-3-15Z",
  run: "m8 5 11 7-11 7V5Z",
  plus: "M12 5v14M5 12h14",
  chevron: "m9 5 7 7-7 7",
  check: "m5 12 4 4 10-10",
  close: "m6 6 12 12M6 18 18 6",
  folder: "M3 7h7l2-3h8v16H3V7Z",
  search: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 6 6",
  terminal: "m4 6 6 6-6 6m9 0h7",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  save: "M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8",
  warning: "m12 3 10 18H2L12 3Zm0 6v5m0 3v1",
  settings: "M4 7h16M4 17h16M8 4v6m8 4v6",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
};
export function Icon({
  name,
  size = 18,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] ?? paths.chip} />
    </svg>
  );
}
