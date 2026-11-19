import type { ReactNode } from "react";
import { NavigationIcon } from "../../components/icons/NavigationIcon";
import { workspaceForScreen, type Screen } from "./workspaces";

type Props = {
  screen: Screen;
  memories: number;
  events: number;
  onNavigate: (screen: Screen) => void;
  onClearAudit: () => void;
  children: ReactNode;
};

const screenTechnicalTitles: Record<Screen, string> = {
  dashboard: "DASHBOARD",
  identificacion: "CONVERSATION",
  nucleo: "COGNITIVE VOLUME",
  flujo: "EVIDENCE FLOW",
  estado: "STATE & CONTROLS",
  planificador: "ACTION PLANNER",
  memoria: "MEMORY VAULT",
  actividad: "COGNITIVE ACTIVITY",
  rostro: "FACE CALIBRATION",
  cuerpo: "BODY SOLVER",
  avatar: "AVATAR VRM",
  puentes: "CAPACIDADES Y PERMISOS",
  auditoria: "AUDITORÍA Y DIAGNÓSTICO",
  habilidades: "TALLER DE HABILIDADES",
  procedimientos: "PROCEDIMIENTOS OBSERVADOS",
  configuracion: "CONFIGURACIÓN",
};

// Implementación React archivada en el código hasta completar la migración.
export function LegacyNavigation({ screen, memories, events, onNavigate, onClearAudit, children }: Props) {
  const workspace = workspaceForScreen(screen);
  return <main data-screen={screen} className={`shell ${screen === "identificacion" ? "is-conversation" : screen === "nucleo" ? "is-volume" : ""}`}>
    <header className="hero">
      <div className="brand-line"><div className="monogram" aria-hidden="true">A</div><p className="eyebrow">ALICE CONTINUUM · MEMORIA, COGNICIÓN Y PRESENCIA</p></div>
      <h1><span>Una presencia digital,</span> <em>bajo tu control.</em></h1>
      <span className="privacy-badge"><i />Local-first</span>
    </header>

    <button type="button" className="dashboard-entry" onClick={() => onNavigate("dashboard")}>← Dashboard</button>

    <nav className="core-system-selector" aria-label="Sistemas de Alice" role="tablist">
      <button type="button" role="tab" aria-selected={workspace === "cognitive"} className={workspace === "cognitive" ? "selected cognitive" : "cognitive"} onClick={() => onNavigate("identificacion")}>
        <span>SYS 01 · MENTE Y CONDUCTA</span><strong>COGNITIVE CORE</strong><small>percepción · memoria · estado · actividad</small>
      </button>
      <button type="button" role="tab" aria-selected={workspace === "body"} className={workspace === "body" ? "selected body" : "body"} onClick={() => onNavigate("rostro")}>
        <span>SYS 02 · PRESENCIA FÍSICA</span><strong>EMBODIMENT CORE</strong><small>rostro · cuerpo · avatar · entorno futuro</small>
      </button>
      <button type="button" role="tab" aria-selected={workspace === "governance"} className={workspace === "governance" ? "selected governance" : "governance"} onClick={() => onNavigate("puentes")}>
        <span>SIS. 00 · CONTROL DEL PROPIETARIO</span><strong>NÚCLEO DE GOBERNANZA</strong><small>permisos · auditoría · habilidades · ajustes</small>
      </button>
    </nav>

    <section className={`core-system-frame system-${workspace}`} aria-labelledby="active-system-title">
      <header className="core-system-heading">
        <div><span>{workspace === "cognitive" ? "[SYS.01] COGNITIVE WORKSPACE" : workspace === "body" ? "[SYS.02] EMBODIMENT WORKSPACE" : "[SIS.00] GOBERNANZA"}</span><h2 id="active-system-title">{workspace === "governance" ? "CONTROL LOCAL DE ALICE" : "ALICE_NEURAL_CORE"} <em>// {screenTechnicalTitles[screen]}</em></h2></div>
        <p><i />{workspace === "cognitive" ? "LOCAL COGNITIVE CORE" : workspace === "body" ? "PHYSICAL OUTPUT · SAFE OFF" : "CONTROL LOCAL DEL PROPIETARIO"}</p>
      </header>

    <nav className="screen-tabs grouped" aria-label={workspace === "cognitive" ? "Pantallas del núcleo cognitivo" : workspace === "body" ? "Pantallas de Body Solver" : "Herramientas de gobierno local"}>
      {workspace === "cognitive" && <>
      <button className={screen === "identificacion" ? "selected" : ""} aria-label="Conversación con Alice" data-tooltip="Conversación" aria-current={screen === "identificacion" ? "page" : undefined} onClick={() => onNavigate("identificacion")}><NavigationIcon kind="identification" active={screen === "identificacion"} /><span className="screen-tab-label">Conversación</span></button>
      <button className={screen === "nucleo" ? "selected" : ""} aria-label="Volumen cognitivo" data-tooltip="Volumen cognitivo" aria-current={screen === "nucleo" ? "page" : undefined} onClick={() => onNavigate("nucleo")}><NavigationIcon kind="volume" active={screen === "nucleo"} /><span className="screen-tab-label">Volumen cognitivo</span></button>
      <button className={screen === "flujo" ? "selected" : ""} aria-label="Flujo cognitivo" data-tooltip="Flujo cognitivo" aria-current={screen === "flujo" ? "page" : undefined} onClick={() => onNavigate("flujo")}><NavigationIcon kind="flow" active={screen === "flujo"} /><span className="screen-tab-label">Flujo cognitivo</span></button>
      <button className={screen === "estado" ? "selected" : ""} aria-label="Estado y controles" data-tooltip="Estado y controles" aria-current={screen === "estado" ? "page" : undefined} onClick={() => onNavigate("estado")}><NavigationIcon kind="state" active={screen === "estado"} /><span className="screen-tab-label">Estado y controles</span></button>
      <button className={screen === "planificador" ? "selected" : ""} aria-label="Planificador de acción" data-tooltip="Planificador" aria-current={screen === "planificador" ? "page" : undefined} onClick={() => onNavigate("planificador")}><NavigationIcon kind="planner" active={screen === "planificador"} /><span className="screen-tab-label">Planificador</span></button>
      <button className={screen === "memoria" ? "selected" : ""} aria-label={`Memoria, ${memories} recuerdos`} data-tooltip="Memoria" aria-current={screen === "memoria" ? "page" : undefined} onClick={() => onNavigate("memoria")}><NavigationIcon kind="memory" active={screen === "memoria"} /><span className="screen-tab-label">Memoria</span><span className="screen-count">{memories}</span></button>
      <button className={screen === "actividad" ? "selected" : ""} aria-label={`Actividad, ${events} eventos`} data-tooltip="Actividad" aria-current={screen === "actividad" ? "page" : undefined} onClick={() => onNavigate("actividad")}><NavigationIcon kind="activity" active={screen === "actividad"} /><span className="screen-tab-label">Actividad</span><span className="screen-count">{events}</span></button>
      </>}
      {workspace === "body" && <>
      <button className={screen === "rostro" ? "selected" : ""} aria-label="Control facial" data-tooltip="Rostro" aria-current={screen === "rostro" ? "page" : undefined} onClick={() => onNavigate("rostro")}><NavigationIcon kind="face" active={screen === "rostro"} /><span className="screen-tab-label">Rostro</span></button>
      <button className={screen === "cuerpo" ? "selected" : ""} aria-label="Solucionador corporal" data-tooltip="Cuerpo" aria-current={screen === "cuerpo" ? "page" : undefined} onClick={() => onNavigate("cuerpo")}><NavigationIcon kind="body" active={screen === "cuerpo"} /><span className="screen-tab-label">Cuerpo</span></button>
      <button className={screen === "avatar" ? "selected" : ""} aria-label="Avatar local" data-tooltip="Avatar" aria-current={screen === "avatar" ? "page" : undefined} onClick={() => onNavigate("avatar")}><NavigationIcon kind="avatar" active={screen === "avatar"} /><span className="screen-tab-label">Avatar</span></button>
      </>}
      {workspace === "governance" && <>
      <button className={screen === "puentes" ? "selected" : ""} aria-label="Capacidades y permisos" data-tooltip="Capacidades y permisos" aria-current={screen === "puentes" ? "page" : undefined} onClick={() => onNavigate("puentes")}><NavigationIcon kind="bridges" active={screen === "puentes"} /><span className="screen-tab-label">Capacidades y permisos</span></button>
      <button className={screen === "auditoria" ? "selected" : ""} aria-label="Auditoría y diagnóstico" data-tooltip="Auditoría y diagnóstico" aria-current={screen === "auditoria" ? "page" : undefined} onClick={() => { onClearAudit(); onNavigate("auditoria"); }}><NavigationIcon kind="audit" active={screen === "auditoria"} /><span className="screen-tab-label">Auditoría y diagnóstico</span></button>
      <button className={screen === "procedimientos" ? "selected" : ""} aria-label="Procedimientos observados" data-tooltip="Procedimientos" aria-current={screen === "procedimientos" ? "page" : undefined} onClick={() => onNavigate("procedimientos")}><NavigationIcon kind="procedures" active={screen === "procedimientos"} /><span className="screen-tab-label">Procedimientos</span></button>
      <button className={screen === "habilidades" ? "selected" : ""} aria-label="Taller de habilidades" data-tooltip="Taller de habilidades" aria-current={screen === "habilidades" ? "page" : undefined} onClick={() => onNavigate("habilidades")}><NavigationIcon kind="skills" active={screen === "habilidades"} /><span className="screen-tab-label">Taller de habilidades</span></button>
      <button className={screen === "configuracion" ? "selected" : ""} aria-label="Configuración" data-tooltip="Configuración" aria-current={screen === "configuracion" ? "page" : undefined} onClick={() => onNavigate("configuracion")}><NavigationIcon kind="settings" active={screen === "configuracion"} /><span className="screen-tab-label">Configuración</span></button>
      </>}
    </nav>

    <div className="core-system-content">{children}</div>
    </section>
  </main>;
}
