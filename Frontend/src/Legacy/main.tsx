import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../styles/base.css";
import "../styles/industrial-theme.css";
import "../styles/memory-records.css";
import "../styles/interaction-affordance.css";
import "../components/cognitive/NeuralVolume.css";
import "../styles/conversation-proposal04.css";
import "../styles/console-theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
