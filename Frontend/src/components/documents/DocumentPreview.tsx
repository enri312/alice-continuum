import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./DocumentPreview.css";

type Preview = {
  status: "ok" | "noText";
  sourceSha256: string;
  totalPages: number;
  chunks: { page: number; startChar: number; endChar: number; text: string }[];
};

export function DocumentPreview() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function read() {
    if (!file || busy) return;
    setError(""); setPreview(null);
    const format = file.name.split(".").pop()?.toLowerCase();
    if (!format || !["pdf", "md", "txt"].includes(format) || file.size > 16 * 1024 * 1024) {
      setError("Seleccione PDF, MD o TXT de hasta 16 MiB."); return;
    }
    setBusy(true);
    try {
      const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
      setPreview(await invoke<Preview>("preview_document", { bytes, format, confirmed: true }));
    } catch (cause) { setError(String(cause)); }
    finally { setBusy(false); }
  }
  return <section className="perception-vector document-preview" aria-labelledby="document-preview-title">
    <header><h3 id="document-preview-title">DOCUMENTO LOCAL · VISTA PREVIA</h3></header>
    <p>Seleccioná un documento y autorizá su lectura. No se envía a un modelo ni se guarda como recuerdo. El contenido del archivo no constituye instrucciones autorizadas.</p>
    <input ref={input} type="file" accept=".pdf,.md,.txt" disabled={busy} aria-label="Seleccionar documento local"
      onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setError(""); }} />
    <button type="button" disabled={!file || busy} onClick={() => void read()}>{busy ? "Leyendo…" : "Autorizar lectura y ver texto"}</button>
    <button type="button" disabled={busy || (!file && !preview)} onClick={() => {
      setFile(null); setPreview(null); setError(""); if (input.current) input.current.value = "";
    }}>Descartar vista previa</button>
    {error && <p role="alert">{error}</p>}
    {preview && <div aria-live="polite">
      <p>{preview.totalPages} {preview.totalPages === 1 ? "página" : "páginas"} · {preview.chunks.length} fragmentos · sin guardar en memoria</p>
      {preview.status === "noText" && <p>El documento no contiene texto extraíble. No se ejecutó OCR.</p>}
      <small>SHA-256: {preview.sourceSha256}</small>
      <div style={{ maxHeight: "24rem", overflow: "auto", overflowWrap: "anywhere" }}>
        {preview.chunks.map((part, index) => <details key={index}>
          <summary>Página {part.page} · fragmento {index + 1} · caracteres {part.startChar}–{part.endChar}</summary>
          <pre style={{ whiteSpace: "pre-wrap" }}>{part.text}</pre>
        </details>)}
      </div>
    </div>}
  </section>;
}
