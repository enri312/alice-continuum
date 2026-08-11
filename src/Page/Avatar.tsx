import { useEffect, useMemo, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { AvatarViewer } from "../components/AvatarViewer";
import type { AvatarTelemetry } from "../components/AvatarViewer";
import type { AvatarAnimationId, AvatarAnimationUrls } from "../core/avatar-animation";

type AvatarStatus = {
  available: boolean;
  path: string;
  fileName: string;
  sizeBytes: number;
};

type AvatarProps = { desktopApp: boolean };

type AvatarAnimationStatus = {
  clips: { id: AvatarAnimationId; path: string; available: boolean; sizeBytes: number }[];
};

function fileSize(bytes: number) {
  return bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : "—";
}

const modificationLabels: Record<string, string> = {
  prohibited: "Prohibida",
  allowModification: "Permitida",
  allowModificationRedistribution: "Permitida con redistribución",
  "no indicada": "No indicada",
};

export function Avatar({ desktopApp }: AvatarProps) {
  const [status, setStatus] = useState<AvatarStatus | null>(null);
  const [telemetry, setTelemetry] = useState<AvatarTelemetry | null>(null);
  const [animationStatus, setAnimationStatus] = useState<AvatarAnimationStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!desktopApp) return;
    Promise.all([invoke<AvatarStatus>("avatar_status"), invoke<AvatarAnimationStatus>("avatar_animation_status")])
      .then(([avatar, animations]) => { setStatus(avatar); setAnimationStatus(animations); })
      .catch((cause) => setError(String(cause)));
  }, [desktopApp]);

  const sourceUrl = useMemo(() => status?.available ? convertFileSrc(status.path) : "", [status]);
  const animationUrls = useMemo<AvatarAnimationUrls>(() => Object.fromEntries(
    animationStatus?.clips.filter((clip) => clip.available).map((clip) => [clip.id, convertFileSrc(clip.path)]) ?? [],
  ), [animationStatus]);

  return <section className="avatar-page" aria-labelledby="avatar-title">
    <div className="avatar-heading">
      <div><p className="eyebrow">AVATAR LOCAL · VRM 1.0</p><h2 id="avatar-title">Cuerpo visible de Alice</h2><p>Esta pantalla inspecciona tu archivo local. Incluye control reversible con gamepad y un ensayo técnico local de diez segundos; todavía no recibe voz, cámara, emociones, Mocap ni órdenes cognitivas.</p></div>
      <div className={`avatar-file-state ${telemetry ? "ready" : ""}`}><i />{telemetry ? "MODELO CARGADO" : status?.available ? "ARCHIVO ENCONTRADO" : "SIN MODELO"}</div>
    </div>

    {!desktopApp && <div className="avatar-unavailable"><span>DESKTOP ONLY</span><strong>El visor requiere la aplicación de escritorio</strong><p>El navegador no obtiene permiso para leer archivos privados del equipo.</p></div>}
    {desktopApp && error && <div className="avatar-unavailable error"><span>ERROR</span><strong>No se pudo comprobar el avatar</strong><p>{error}</p></div>}
    {desktopApp && status && !status.available && <div className="avatar-unavailable"><span>VRM 000</span><strong>No se encontró Alice.vrm</strong><p>Colocá el archivo en <code>{status.path}</code> y reiniciá la aplicación.</p></div>}

    {desktopApp && sourceUrl && <div className="avatar-layout">
      <div className="avatar-stage"><AvatarViewer sourceUrl={sourceUrl} animationUrls={animationUrls} onTelemetry={setTelemetry} /></div>
      <aside className="avatar-inspector">
        <p className="eyebrow">INSPECTOR VRM</p>
        <h3>{telemetry?.name ?? status?.fileName ?? "Alice"}</h3>
        <span className="avatar-version">VRM {telemetry?.metaVersion ?? "—"} · {fileSize(status?.sizeBytes ?? 0)}</span>
        <dl>
          <div><dt>Autoría</dt><dd>{telemetry?.authors.join(", ") || "Leyendo…"}</dd></div>
          <div><dt>Copyright</dt><dd>{telemetry?.copyright ?? "Leyendo…"}</dd></div>
          <div><dt>Huesos humanoides</dt><dd>{telemetry?.boneCount ?? "—"}</dd></div>
          <div><dt>Expresiones declaradas</dt><dd>{telemetry?.expressionCount ?? "—"}</dd></div>
          <div><dt>Spring joints</dt><dd>{telemetry?.springJointCount ?? "—"}</dd></div>
          <div><dt>Colliders</dt><dd>{telemetry?.colliderCount ?? "—"}</dd></div>
          <div><dt>Clips corporales</dt><dd>{animationStatus?.clips.filter((clip) => clip.available).length ?? "—"} / 9</dd></div>
        </dl>
        <div className="avatar-license">
          <strong>LICENCIA DEL ARCHIVO</strong>
          <span>Crédito: {telemetry ? telemetry.creditRequired ? "requerido" : "no requerido" : "—"}</span>
          <span>Redistribución: {telemetry ? telemetry.redistributionAllowed ? "permitida" : "prohibida" : "—"}</span>
          <span>Modificación: {telemetry ? modificationLabels[telemetry.modification] ?? telemetry.modification : "—"}</span>
        </div>
        <code className="avatar-path" title={status?.path}>{status?.path}</code>
      </aside>
    </div>}

    <div className="avatar-boundaries">
      <article><span>01</span><strong>Render local</strong><small>{telemetry ? "Activo y comprobado" : "Esperando carga"}</small></article>
      <article><span>02</span><strong>Expresión dirigida</strong><small>Desconectada</small></article>
      <article><span>03</span><strong>Voz y labios</strong><small>Desconectados</small></article>
      <article><span>04</span><strong>Cuerpo y Ragdoll</strong><small>Prueba manual · puente planificado</small></article>
    </div>
    <p className="avatar-footnote">La entrada PS5 y el ensayo técnico controlan directamente el visor sólo después de activarlos y no representan decisiones de Alice. Los clips Mixamo se retargetean localmente; el IK de pies, la locomoción física, Active Ragdoll y el puente cognitivo continúan desconectados.</p>
  </section>;
}
