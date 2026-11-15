import { useState } from "react";
import type { ReactNode } from "react";
import { DocumentPreview } from "../../components/documents/DocumentPreview";
import type { IdentificationInputs } from "../../core/cognitive/identification";
import { InputDiagnostics } from "./InputDiagnostics";
import "../../styles/conversation-home.css";

type IdentificacionProps = IdentificationInputs & {
  observationAvailable: boolean;
  onToggleObservation: () => void;
  conversationPanel: ReactNode;
};

// Keep the existing route and export so navigation and stored links remain valid.
export function Identificacion({ conversationPanel, ...inputs }: IdentificacionProps) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  return <section className="conversation-home" aria-labelledby="conversation-home-title">
    <header className="conversation-home-heading">
      <div><h2 id="conversation-home-title">Conversación con Alice</h2><p>Escribe o habla. Este es tu espacio para conversar.</p></div>
      <span className="conversation-home-label">TEXTO Y VOZ</span>
    </header>
    <div className="conversation-home-main">{conversationPanel}</div>
    <div className="conversation-secondary-tools" aria-label="Herramientas complementarias">
      <details className="conversation-secondary-panel" onToggle={event => setDiagnosticsOpen(event.currentTarget.open)}>
        <summary>Diagnóstico de entrada<span>Ver cómo se analiza el mensaje</span></summary>
        {diagnosticsOpen && <InputDiagnostics {...inputs} />}
      </details>
      <details className="conversation-secondary-panel">
        <summary>Documentos locales<span>Abrir una vista previa independiente del chat</span></summary>
        <DocumentPreview />
      </details>
    </div>
  </section>;
}
