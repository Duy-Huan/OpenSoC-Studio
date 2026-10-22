import { createRoot } from "react-dom/client";
import "dockview-react/dist/styles/dockview.css";
import "@xyflow/react/dist/style.css";
import "./style.css";
import App from "./App";
createRoot(document.getElementById("root")!).render(<App />);
