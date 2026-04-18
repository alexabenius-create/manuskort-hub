import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installFlushHandlers } from "./lib/flushRegistry";

installFlushHandlers();

createRoot(document.getElementById("root")!).render(<App />);
