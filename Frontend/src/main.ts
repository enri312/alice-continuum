import { startApp } from "./core/navigation/app-shell";
import "./styles/base.css";
import "./styles/industrial-theme.css";
import "./styles/memory-records.css";
import "./styles/interaction-affordance.css";
import "./components/cognitive/NeuralVolume.css";
import "./styles/conversation-proposal04.css";
import "./styles/console-theme.css";

const stop = startApp(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.dispose(stop);
