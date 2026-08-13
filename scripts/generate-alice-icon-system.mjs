import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../icons/", import.meta.url));
const handAuthoredIcons = new Set(["nav-memory.svg", "nav-avatar.svg", "nav-conversation.svg", "bridge-face.svg"]);

const icons = [
  ["nav-conversation.svg", "conversation", "Conversación", "#22d3ee", "#34d399", `
    <g transform="translate(100 91)" filter="url(#conversation-shadow)">
      <path d="M-55-31 0-55 55-31 0-7z" fill="#13283a" stroke="{{A}}" stroke-width="1.8"/>
      <path d="M-55-31 0-7v47l-55-24z" fill="#071521" stroke="#164e63"/><path d="M55-31 0-7v47l55-24z" fill="#0b1d29" stroke="#155e75"/>
      <path d="M-43-29 0-47 43-29 0-11z" fill="#06202b" stroke="#67e8f9"/>
      <path d="M-31-30h13l7-7 10 16 9-18 9 13h16" fill="none" stroke="{{A}}" stroke-width="3" stroke-linecap="round" filter="url(#conversation-glow)"/>
      <path d="M-33 0h26l8 8 8-8h24v18H9L1 27l-8-9h-26z" fill="#0d2630" stroke="{{B}}"/>
      <circle cx="-19" cy="9" r="2" fill="{{B}}"/><circle cx="-9" cy="9" r="2" fill="{{B}}"/><circle cx="1" cy="9" r="2" fill="{{B}}"/>
    </g><path d="M76 137q24 12 48 0" fill="none" stroke="{{B}}" stroke-width="2" stroke-dasharray="3 4"/>`],
  ["nav-nucleus.svg", "nucleus", "Volumen cognitivo", "#fbbf24", "#22d3ee", `
    <g transform="translate(100 91)" filter="url(#nucleus-shadow)"><ellipse cy="48" rx="52" ry="14" fill="#020617" stroke="{{A}}" opacity=".9"/>
      <g fill="none" stroke-width="1.6"><ellipse rx="57" ry="29" stroke="{{A}}"/><ellipse rx="57" ry="29" stroke="{{B}}" transform="rotate(60)"/><ellipse rx="57" ry="29" stroke="#f472b6" transform="rotate(120)"/></g>
      <circle r="29" fill="url(#nucleus-holo)" stroke="#fff7c2" stroke-width="2" filter="url(#nucleus-glow)"/><circle r="15" fill="#fff" opacity=".25"/>
      <g fill="#fff"><circle cx="-55" cy="-7" r="4"/><circle cx="34" cy="-44" r="4"/><circle cx="31" cy="45" r="4"/></g>
      <g stroke="#fff8" stroke-width="1"><path d="M-18-8 0-19 20-7 15 15-8 19-18-8z" fill="none"/><path d="M-18-8 15 15M0-19-8 19M20-7-8 19"/></g>
    </g>`],
  ["nav-memory.svg", "memory", "Memoria", "#a78bfa", "#f472b6", `
    <g transform="translate(100 87)" filter="url(#memory-shadow)">
      <ellipse cy="48" rx="55" ry="15" fill="#100c24" stroke="{{B}}" opacity=".65"/>
      <path d="M-43-36c0-12 19-21 43-21s43 9 43 21v72c0 12-19 21-43 21s-43-9-43-21z" fill="#171330" stroke="{{A}}" stroke-width="2"/>
      <ellipse cy="-36" rx="43" ry="21" fill="#251b52" stroke="#ddd6fe"/><ellipse cy="-36" rx="28" ry="11" fill="#6d4fc0" stroke="{{B}}"/>
      <path d="M-43-11c0 12 19 21 43 21s43-9 43-21M-43 14c0 12 19 21 43 21s43-9 43-21" fill="none" stroke="#c4b5fd" stroke-width="1.5"/>
      <g fill="{{B}}" filter="url(#memory-glow)"><circle cx="-27" cy="-7" r="3"/><circle cx="29" cy="18" r="3"/><circle cy="-36" r="4"/></g>
      <path d="M0-31v19l-12 8m12-8 12 8" stroke="#fff" stroke-width="2" fill="none"/>
    </g>`],
  ["nav-activity.svg", "activity", "Actividad", "#84cc16", "#22d3ee", `
    <g transform="translate(100 88)" filter="url(#activity-shadow)">
      <path d="M-57-42 43-52 57 35-43 46z" fill="#07180f" stroke="{{A}}" stroke-width="2"/>
      <g stroke="#1e4225" stroke-width=".7"><path d="M-48-20 48-29M-46 1 51-8M-43 23 54 14M-25-45-13 42M0-47 12 39M25-49 37 37"/></g>
      <path d="M-48 13-33 11l9-23 15 35L4-31l16 36 10-20 10 17 11-2" fill="none" stroke="{{A}}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#activity-glow)"/>
      <circle cx="-48" cy="13" r="3" fill="{{B}}"/><circle cx="51" r="3" fill="{{B}}"/>
    </g><g transform="translate(58 145)"><rect width="84" height="7" rx="3.5" fill="#183321"/><rect width="57" height="7" rx="3.5" fill="{{A}}"/><circle cx="57" cy="3.5" r="6" fill="#ecfccb" stroke="{{A}}"/></g>`],
  ["nav-bridges.svg", "bridges", "Puentes corporales", "#38bdf8", "#fb923c", `
    <g transform="translate(100 91)" filter="url(#bridges-shadow)">
      <path d="M-58 34 0 5l58 29L0 62z" fill="#111827" stroke="#64748b"/><path d="M-58 34 0 62v10l-58-28z" fill="#060b13"/><path d="M58 34 0 62v10l58-28z" fill="#0b111b"/>
      <g transform="translate(-30 -3)"><path d="M-18-28 0-38l18 10L0-18z" fill="#164e63" stroke="{{A}}"/><path d="M-18-28 0-18v39l-18-10z" fill="#082f49"/><path d="M18-28 0-18v39l18-10z" fill="#0c4a6e"/><circle cy="-26" r="4" fill="{{A}}"/></g>
      <g transform="translate(30 -3)"><path d="M-18-28 0-38l18 10L0-18z" fill="#7c2d12" stroke="{{B}}"/><path d="M-18-28 0-18v39l-18-10z" fill="#431407"/><path d="M18-28 0-18v39l18-10z" fill="#7c2d12"/><circle cy="-26" r="4" fill="{{B}}"/></g>
      <path d="M-30-29Q0-57 30-29M-30-18Q0 5 30-18" fill="none" stroke="url(#bridges-accent)" stroke-width="4" filter="url(#bridges-glow)"/><circle cy="-38" r="6" fill="#fff"/>
    </g>`],
  ["nav-avatar.svg", "avatar", "Avatar", "#f472b6", "#38bdf8", `
    <g transform="translate(100 91)" filter="url(#avatar-shadow)">
      <ellipse cy="50" rx="48" ry="13" fill="#0f172a" stroke="{{B}}"/><path d="M-38 51c3-27 17-41 38-41s35 14 38 41" fill="#162738" stroke="{{B}}" stroke-width="2"/>
      <path d="M-31-31C-27-53-15-64 0-64s27 11 31 33V0c0 25-13 41-31 41S-31 25-31 0z" fill="#465565" stroke="#dbeafe" stroke-width="2"/>
      <path d="M-25-17c7-11 43-11 50 0V5C16 16-16 16-25 5z" fill="#061521" stroke="{{B}}"/>
      <path d="M-17-5h12m10 0h12" stroke="{{A}}" stroke-width="5" stroke-linecap="round" filter="url(#avatar-glow)"/><path d="M-9 22q9 6 18 0" fill="none" stroke="#fce7f3"/>
      <circle cy="52" r="6" fill="{{A}}"/><path d="m-6 52 6-7 6 7-6 7z" fill="#fff" opacity=".45"/>
    </g>`],
  ["nav-identification.svg", "identification", "Identificación", "#0ea5e9", "#10b981", `
    <g transform="translate(100 91) rotate(-4)" filter="url(#identification-shadow)">
      <path d="M-56-43 52-36 56 44-52 37z" fill="#082332" stroke="{{A}}" stroke-width="2"/><path d="M-47-34 44-29 47 34-44 29z" fill="#0c3444" stroke="#7dd3fc"/>
      <circle cx="-22" cy="-7" r="14" fill="#24475a" stroke="#bae6fd"/><path d="M-43 24q4-21 21-21T0 27" fill="#17394a" stroke="{{A}}"/>
      <path d="M9-16h26M9-5h20M9 10h29M9 21h23" stroke="#bae6fd" stroke-width="3" stroke-linecap="round"/>
      <path d="M-46-31v12m0-12h12M44-26H32m12 0v12M-48 26v-12m0 12h12M47 31H35m12 0V19" fill="none" stroke="{{B}}" stroke-width="2"/>
      <circle cx="34" cy="24" r="6" fill="{{B}}" filter="url(#identification-glow)"/><path d="m31 24 2 2 5-6" fill="none" stroke="#052e25" stroke-width="2"/>
    </g>`],
  ["nav-settings.svg", "settings", "Configuración", "#f59e0b", "#38bdf8", `
    <g transform="translate(100 91)" filter="url(#settings-shadow)">
      <circle r="49" fill="#111827" stroke="#64748b"/><circle r="37" fill="none" stroke="{{A}}" stroke-width="7" stroke-dasharray="10 8"/>
      <path d="m0-56 7 12h-14zm56 56-12 7V-7zM0 56l-7-12H7zM-56 0l12-7V7z" fill="#d1d5db" stroke="{{A}}"/>
      <circle r="24" fill="#0c2634" stroke="{{B}}" stroke-width="2"/><circle r="10" fill="{{A}}" stroke="#fff4" filter="url(#settings-glow)"/>
      <path d="M0-22V-9M22 0H9M0 22V9M-22 0h13" stroke="#e0f2fe" stroke-width="2"/>
    </g><g transform="translate(48 145)"><path d="M0 0h104" stroke="#334155" stroke-width="5"/><circle cx="25" r="7" fill="{{B}}"/><circle cx="79" r="7" fill="{{A}}"/></g>`],
  ["nav-skills.svg", "skills", "Habilidades", "#fb923c", "#a78bfa", `
    <g transform="translate(100 91)" filter="url(#skills-shadow)">
      <path d="M-59 38 0 8l59 30L0 68z" fill="#111827" stroke="#64748b"/><path d="M-59 38 0 68v9l-59-29z" fill="#080b12"/><path d="M59 38 0 68v9l59-29z" fill="#0b111b"/>
      <g transform="rotate(-28)"><path d="M-8-56h16v102H-8z" fill="#94a3b8" stroke="{{A}}"/><path d="M-15-43h30v17h-30z" fill="#334155" stroke="#e2e8f0"/><circle cy="37" r="5" fill="#0f172a" stroke="{{A}}"/></g>
      <g transform="rotate(33)"><path d="M-6-53h12v92H-6z" fill="#7c3aed" stroke="{{B}}"/><path d="m0-66-9 16h18z" fill="#ddd6fe"/><path d="M-10 16h20v29h-20z" fill="#1e1b4b" stroke="{{B}}"/></g>
      <circle r="13" fill="#0f172a" stroke="#fff"/><path d="m-6 0 4 5 9-11" fill="none" stroke="#4ade80" stroke-width="3"/>
    </g>`],
  ["nav-procedures.svg", "procedures", "Procedimientos", "#34d399", "#fbbf24", `
    <g transform="translate(100 89)" filter="url(#procedures-shadow)">
      <path d="M-50-53 45-45 50 54-45 46z" fill="#0d1f22" stroke="{{A}}" stroke-width="2"/><path d="M-40-42 35-36 39 43-36 37z" fill="#101923" stroke="#64748b"/>
      <g fill="#071318" stroke-width="1.5"><rect x="-28" y="-26" width="18" height="18" rx="3" stroke="{{A}}"/><rect x="-28" y="1" width="18" height="18" rx="3" stroke="{{A}}"/><rect x="-28" y="28" width="18" height="18" rx="3" stroke="{{B}}"/></g>
      <path d="m-24-17 4 4 8-10m-12 33 4 4 8-10" fill="none" stroke="#ecfdf5" stroke-width="2.5"/>
      <circle cx="-19" cy="37" r="4" fill="{{B}}" filter="url(#procedures-glow)"/>
      <path d="M1-20h27M1-11h20M1 7h30M1 16h24M1 34h28M1 43h18" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round"/>
      <path d="M-19-8V1m0 18v9" stroke="#64748b"/>
    </g>`],
  ["bridge-overview.svg", "overview", "Resumen de puentes", "#2dd4bf", "#fb923c", `
    <g transform="translate(100 91)" filter="url(#overview-shadow)"><ellipse cy="48" rx="55" ry="14" fill="#052e2b" stroke="{{A}}" opacity=".55"/>
      <circle r="54" fill="#071c22" stroke="{{A}}" stroke-width="2"/><g fill="none" stroke="#1f5e62"><circle r="39"/><circle r="23"/><path d="M-54 0h108M0-54v108M-38-38l76 76M38-38l-76 76"/></g>
      <path d="M0 0 39-31A50 50 0 0 1 50 15z" fill="{{A}}" opacity=".25"/><path d="M0 0 39-31" stroke="{{A}}" stroke-width="3" filter="url(#overview-glow)"/>
      <g fill="#fff"><circle cx="-26" cy="-31" r="5"/><circle cx="37" cy="-10" r="5"/><circle cx="17" cy="38" r="5"/></g><g fill="{{B}}"><circle cx="-26" cy="-31" r="2"/><circle cx="37" cy="-10" r="2"/><circle cx="17" cy="38" r="2"/></g>
    </g>`],
  ["bridge-face.svg", "face", "Puente facial", "#f472b6", "#22d3ee", `
    <g transform="translate(100 91)" filter="url(#face-shadow)"><ellipse cy="51" rx="46" ry="12" fill="#2a0d25" stroke="{{A}}" opacity=".7"/>
      <path d="M-31-34C-27-56-14-66 0-66s27 10 31 32V0c0 27-13 44-31 44S-31 27-31 0z" fill="#60436e" stroke="#f5d0fe" stroke-width="2"/>
      <path d="M-24-17c7-11 41-11 48 0V6C15 17-15 17-24 6z" fill="#140d1d" stroke="{{A}}"/>
      <path d="M-16-5h11M5-5h11" stroke="{{B}}" stroke-width="5" stroke-linecap="round" filter="url(#face-glow)"/><path d="M-8 24q8 5 16 0" fill="none" stroke="#fae8ff"/>
      <g fill="none" stroke="{{A}}" stroke-width="2"><path d="M-50-40v-14h14M50-40v-14H36M-50 35v14h14M50 35v14H36"/><path d="M-44-17h20M24-17h20M-44 7h20M24 7h20"/></g>
      <circle cy="-5" r="3" fill="#fff"/>
    </g>`],
  ["bridge-body.svg", "body", "Puente corporal", "#facc15", "#4ade80", `
    <g transform="translate(100 91)" filter="url(#body-shadow)"><ellipse cy="54" rx="51" ry="13" fill="#302507" stroke="{{A}}" opacity=".55"/>
      <g fill="none" stroke="#d7b733" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M0-39v50M0-23-32-6-51-20M0-23l32-6 51-20M0 11-21 49M0 11l21 49"/></g>
      <g fill="#fff7b2" stroke="{{A}}" stroke-width="2"><circle cy="-54" r="13"/><circle cy="-23" r="6"/><circle cx="-32" cy="-29" r="6"/><circle cx="32" cy="-29" r="6"/><circle cy="11" r="6"/><circle cx="-21" cy="49" r="6"/><circle cx="21" cy="49" r="6"/></g>
      <g fill="{{B}}" filter="url(#body-glow)"><circle cy="-23" r="2"/><circle cx="-32" cy="-29" r="2"/><circle cx="32" cy="-29" r="2"/><circle cy="11" r="2"/></g>
      <path d="M-51-20-55-4m106-16 4 16M-21 49l-7 8m49-8 7 8" stroke="#fde68a" stroke-width="4" stroke-linecap="round"/>
    </g>`],
  ["nucleus-volume.svg", "volume", "Volumen neuronal 3D", "#22d3ee", "#fbbf24", `
    <g transform="translate(100 91)" filter="url(#volume-shadow)"><ellipse cy="50" rx="59" ry="15" fill="#082f49" stroke="{{A}}" opacity=".5"/>
      <g fill="none"><ellipse rx="61" ry="33" stroke="{{A}}" stroke-width="1.4"/><ellipse rx="61" ry="33" stroke="{{B}}" transform="rotate(60)"/><ellipse rx="61" ry="33" stroke="#f472b6" transform="rotate(120)"/></g>
      <g stroke="#477081" stroke-width=".8"><path d="m-48-18 21 14 15-31L8-8l22-30 17 20M-52 18l25-22 17 33L8-8l22 34 22-8" fill="none"/><path d="M-27-4 30 26M-12-35-10 29M8-8 47-18"/></g>
      <circle r="25" fill="url(#volume-holo)" stroke="#cffafe" stroke-width="2" filter="url(#volume-glow)"/>
      <g fill="#fff"><circle cx="-48" cy="-18" r="4"/><circle cx="-12" cy="-35" r="4"/><circle cx="47" cy="-18" r="4"/><circle cx="-52" cy="18" r="4"/><circle cx="-10" cy="29" r="4"/><circle cx="52" cy="18" r="4"/></g><g fill="{{B}}"><circle cx="-48" cy="-18" r="2"/><circle cx="47" cy="-18" r="2"/><circle cx="-10" cy="29" r="2"/></g>
    </g>`],
  ["nucleus-flow.svg", "flow", "Flujo cognitivo", "#8b5cf6", "#ec4899", `
    <g transform="translate(100 91)" filter="url(#flow-shadow)">
      <path d="M-61 43 0 13l61 30L0 73z" fill="#111126" stroke="#645a85"/><path d="M-61 43 0 73v8l-61-30z" fill="#090816"/><path d="M61 43 0 73v8l61-30z" fill="#0e0c1d"/>
      <path d="M-55-1h22c11 0 9-34 22-34H5c13 0 12 67 25 67h27M-55-32h17c12 0 10 58 24 58H2c13 0 13-28 27-28h28" fill="none" stroke="url(#flow-accent)" stroke-width="4" stroke-linecap="round" filter="url(#flow-glow)"/>
      <g stroke="#fff" stroke-width="1.5"><circle cx="-55" cy="-1" r="7" fill="{{A}}"/><circle cx="-11" cy="-35" r="7" fill="#a78bfa"/><circle cx="30" cy="32" r="7" fill="{{B}}"/><circle cx="57" cy="32" r="7" fill="#f9a8d4"/></g>
      <path d="m51 27 6 5-6 5" fill="none" stroke="#fff" stroke-width="2"/>
    </g>`],
  ["nucleus-state.svg", "state", "Estado interno", "#10b981", "#f59e0b", `
    <g transform="translate(100 91)" filter="url(#state-shadow)">
      <path d="M-57-44 48-50 57 43-48 49z" fill="#071b18" stroke="{{A}}" stroke-width="2"/>
      <path d="M-47-27h87l2 21h-87z" fill="#0b2824" stroke="#6ee7b7"/><path d="M-39-16h10l6-8 8 15 10-23 10 21 7-9 6 5h18" fill="none" stroke="{{A}}" stroke-width="2.5" filter="url(#state-glow)"/>
      <g><path d="M-42 8h82" stroke="#1f3c38" stroke-width="8"/><path d="M-42 8h62" stroke="{{A}}" stroke-width="8"/><circle cx="20" cy="8" r="7" fill="#d1fae5" stroke="{{A}}"/><path d="M-42 29h82" stroke="#3d301e" stroke-width="8"/><path d="M-42 29h39" stroke="{{B}}" stroke-width="8"/><circle cx="-3" cy="29" r="7" fill="#fef3c7" stroke="{{B}}"/></g>
    </g>`],
  ["nucleus-planner.svg", "planner", "Planificador de acciones", "#f59e0b", "#38bdf8", `
    <g transform="translate(100 91)" filter="url(#planner-shadow)"><ellipse cy="50" rx="54" ry="14" fill="#3b2406" stroke="{{A}}" opacity=".5"/>
      <circle r="51" fill="#171207" stroke="{{A}}" stroke-width="2"/><circle r="38" fill="none" stroke="#71531c" stroke-dasharray="4 5"/>
      <g fill="{{B}}"><circle cy="-42" r="4"/><circle cx="42" r="4"/><circle cy="42" r="4"/><circle cx="-42" r="4"/></g>
      <path d="M0 0v-34M0 0l27 17" stroke="{{A}}" stroke-width="6" stroke-linecap="round" filter="url(#planner-glow)"/><circle r="9" fill="#fff1b8" stroke="#a16207"/>
      <path d="M-59-44h23v14h-23zm95 73h23v14H36z" fill="#082f49" stroke="{{B}}"/><path d="m-54-37 4 4 8-8m83 77 4 4 8-8" fill="none" stroke="#a7f3d0" stroke-width="2"/>
    </g>`],
  ["view-pan.svg", "pan", "Desplazar vista", "#38bdf8", "#22d3ee", `
    <g transform="translate(100 91)" filter="url(#pan-shadow)"><ellipse cy="50" rx="51" ry="13" fill="#082f49" stroke="{{A}}" opacity=".5"/><circle r="39" fill="#0b2535" stroke="{{A}}" stroke-width="2"/>
      <path d="M0-57-13-42h8v24h-13v-8L-38 0l20 26v-8h13v24h-8L0 57l13-15H5V18h13v8L38 0 18-26v8H5v-24h8z" fill="{{A}}" stroke="#e0f2fe" stroke-width="1.5" filter="url(#pan-glow)"/><circle r="11" fill="#e0f2fe"/>
    </g>`],
  ["view-reset.svg", "reset", "Restablecer vista", "#a78bfa", "#f472b6", `
    <g transform="translate(100 91)" filter="url(#reset-shadow)"><ellipse cy="51" rx="51" ry="13" fill="#2e1065" stroke="{{A}}" opacity=".45"/>
      <path d="M41-26A49 49 0 1 0 46 25" fill="none" stroke="{{A}}" stroke-width="10" stroke-linecap="round" filter="url(#reset-glow)"/><path d="m38-49 7 26-27-5z" fill="{{A}}" stroke="#ede9fe"/>
      <path d="M-22-23 0-35l22 12L0-11z" fill="#4c1d95" stroke="{{B}}"/><path d="M-22-23 0-11v29l-22-12z" fill="#2e1065"/><path d="M22-23 0-11v29L22 6z" fill="#3b0764"/><circle cy="-11" r="5" fill="#fef08a"/>
    </g>`],
  ["view-rotate.svg", "rotate", "Rotar vista", "#22d3ee", "#fb923c", `
    <g transform="translate(100 91)" filter="url(#rotate-shadow)"><ellipse cy="51" rx="51" ry="13" fill="#082f49" stroke="{{A}}" opacity=".5"/><circle r="36" fill="url(#rotate-holo)" stroke="#a5f3fc"/>
      <ellipse rx="36" ry="14" fill="none" stroke="#cffafe"/><ellipse rx="14" ry="36" fill="none" stroke="#67e8f9"/>
      <path d="M-48-9a50 50 0 0 1 75-34" fill="none" stroke="{{A}}" stroke-width="7" stroke-linecap="round" filter="url(#rotate-glow)"/><path d="m35-47-7 22-17-15z" fill="{{A}}"/>
      <path d="M48 9a50 50 0 0 1-75 34" fill="none" stroke="{{B}}" stroke-width="7" stroke-linecap="round"/><path d="m-35 47 7-22 17 15z" fill="{{B}}"/>
    </g>`],
  ["view-zoom-in.svg", "zoomin", "Acercar vista", "#34d399", "#22d3ee", `
    <g transform="translate(94 84)" filter="url(#zoomin-shadow)"><ellipse cx="8" cy="58" rx="51" ry="13" fill="#064e3b" stroke="{{A}}" opacity=".4"/><circle r="43" fill="#08251f" stroke="{{A}}" stroke-width="7" filter="url(#zoomin-glow)"/><circle r="32" fill="none" stroke="#6ee7b7" stroke-dasharray="4 4"/><path d="M31 31l43 43" stroke="#d1fae5" stroke-width="14" stroke-linecap="round"/><path d="M-21 0h42M0-21v42" stroke="#ecfdf5" stroke-width="7" stroke-linecap="round"/><path d="m53 54 12-12 18 18-12 12z" fill="#164e3f" stroke="{{B}}"/>
    </g>`],
  ["view-zoom-out.svg", "zoomout", "Alejar vista", "#fb923c", "#ef4444", `
    <g transform="translate(94 84)" filter="url(#zoomout-shadow)"><ellipse cx="8" cy="58" rx="51" ry="13" fill="#7c2d12" stroke="{{A}}" opacity=".4"/><circle r="43" fill="#2b160d" stroke="{{A}}" stroke-width="7" filter="url(#zoomout-glow)"/><circle r="32" fill="none" stroke="#fdba74" stroke-dasharray="4 4"/><path d="M31 31l43 43" stroke="#ffedd5" stroke-width="14" stroke-linecap="round"/><path d="M-21 0h42" stroke="#fff7ed" stroke-width="7" stroke-linecap="round"/><path d="m53 54 12-12 18 18-12 12z" fill="#7c2d12" stroke="{{B}}"/>
    </g>`],
];

const semanticDetails = {
  conversation: `<g font-family="Consolas,monospace" font-weight="900"><g transform="translate(38 125)"><rect width="42" height="21" rx="3" fill="#061827" stroke="{{A}}"/><text x="21" y="8" fill="{{A}}" font-size="5" text-anchor="middle">PRIVACY GATE</text><path d="M6 14h19" stroke="#64748b"/><circle cx="33" cy="14" r="3" fill="{{B}}"/></g><g transform="translate(120 125)"><rect width="42" height="21" rx="3" fill="#061827" stroke="{{B}}"/><text x="21" y="8" fill="{{B}}" font-size="5" text-anchor="middle">CLOUD ROUTE</text><path d="M7 14h10m5 0h13" stroke="#64748b"/><circle cx="18" cy="14" r="2" fill="{{A}}"/></g><path d="M80 135h40" stroke="{{A}}" stroke-dasharray="3 2"/><path d="m115 131 6 4-6 4" fill="none" stroke="{{A}}"/><text x="100" y="154" fill="#94a3b8" font-size="5" text-anchor="middle">REVIEW · AUTHORIZE · SEND</text></g>`,
  nucleus: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g fill="#071521" stroke="{{A}}"><rect x="34" y="121" width="35" height="18" rx="3"/><rect x="131" y="121" width="35" height="18" rx="3"/></g><text x="51" y="129" fill="{{A}}" text-anchor="middle">MEMORY</text><text x="148" y="129" fill="{{B}}" text-anchor="middle">OUTPUT</text><path d="M40 134h20m77 0h22" stroke="#64748b"/><circle cx="51" cy="134" r="2" fill="{{B}}"/><circle cx="148" cy="134" r="2" fill="{{A}}"/><path d="M69 130h18m26 0h18" stroke="{{B}}" stroke-dasharray="3 2"/><text x="100" y="151" fill="#fef3c7" text-anchor="middle">R3 SIGNAL · 5 MIN WINDOW</text></g>`,
  activity: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g transform="translate(36 128)"><rect width="128" height="25" rx="3" fill="#07110b" stroke="{{A}}"/><path d="M5 8h118M5 16h118" stroke="#1f3b24"/><g fill="{{B}}"><circle cx="14" cy="8" r="2"/><circle cx="43" cy="16" r="2"/><circle cx="76" cy="8" r="2"/><circle cx="111" cy="16" r="2"/></g><path d="M14 8 43 16 76 8l35 8" fill="none" stroke="{{A}}"/><text x="8" y="23" fill="#94a3b8">SEQ</text><text x="47" y="23" fill="#94a3b8">MODULE</text><text x="94" y="23" fill="#94a3b8">PAYLOAD</text></g><text x="100" y="160" fill="{{A}}" text-anchor="middle">TIMELINE · EVENT STREAM · R3</text></g>`,
  bridges: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g transform="translate(37 127)"><rect width="126" height="26" rx="3" fill="#07111e" stroke="#475569"/><g fill="#0c2634" stroke="{{A}}"><rect x="5" y="5" width="20" height="16"/><rect x="30" y="5" width="20" height="16"/><rect x="55" y="5" width="20" height="16"/></g><g fill="#2a170a" stroke="{{B}}"><rect x="80" y="5" width="20" height="16"/><rect x="105" y="5" width="16" height="16"/></g><text x="15" y="15" fill="{{A}}" text-anchor="middle">MEM</text><text x="40" y="15" fill="{{A}}" text-anchor="middle">SEN</text><text x="65" y="15" fill="{{A}}" text-anchor="middle">AI</text><text x="90" y="15" fill="{{B}}" text-anchor="middle">FACE</text><text x="113" y="15" fill="{{B}}" text-anchor="middle">BODY</text></g><text x="100" y="160" fill="#fca5a5" text-anchor="middle">REGISTRY · PASSIVE PROBES · SAFE OFF</text></g>`,
  avatar: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g transform="translate(36 127)"><rect width="128" height="27" rx="3" fill="#0b1320" stroke="{{B}}"/><path d="M10 8h22m-22 7h34m-34 7h25" stroke="#64748b"/><text x="52" y="9" fill="{{B}}">VRM PRIVATE</text><text x="52" y="17" fill="{{A}}">IDLE → WALK → SIT</text><text x="52" y="24" fill="#4ade80">DUALSENSE · CONNECTED</text><g transform="translate(105 14)" fill="none" stroke="{{A}}"><path d="M-16 5q2-16 10-12h12q8-4 10 12l-7 3-5-6h-8l-5 6z"/><circle cx="8" cy="-2" r="2"/><path d="M-10-2h6m-3-3v6"/></g></g></g>`,
  identification: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g transform="translate(35 126)"><rect width="130" height="29" rx="3" fill="#061827" stroke="{{A}}"/><text x="6" y="8" fill="#94a3b8">SOURCE</text><text x="45" y="8" fill="{{B}}">LOCAL_INPUT</text><text x="6" y="16" fill="#94a3b8">SPEAKER</text><text x="45" y="16" fill="#e2e8f0">OWNER</text><text x="6" y="24" fill="#94a3b8">INTENT</text><text x="45" y="24" fill="{{A}}">PENDING</text><g transform="translate(88 6)" fill="#0c4a6e" stroke="{{A}}"><rect width="13" height="8" rx="2"/><rect x="15" width="13" height="8" rx="2"/><rect x="30" width="13" height="8" rx="2"/></g><path d="M88 20h43" stroke="#334155" stroke-width="4"/><path d="M88 20h27" stroke="{{B}}" stroke-width="4"/></g><text x="100" y="162" fill="{{A}}" text-anchor="middle">TOKENS · VECTOR · CONFIDENCE</text></g>`,
  settings: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g transform="translate(36 126)"><rect width="128" height="29" rx="3" fill="#11100a" stroke="{{A}}"/><g fill="#1e293b" stroke="#64748b"><rect x="5" y="5" width="36" height="19"/><rect x="46" y="5" width="36" height="19"/><rect x="87" y="5" width="36" height="19"/></g><text x="23" y="12" fill="{{A}}" text-anchor="middle">PROVIDER</text><text x="64" y="12" fill="{{B}}" text-anchor="middle">PRIVACY</text><text x="105" y="12" fill="#4ade80" text-anchor="middle">HARDWARE</text><path d="M10 18h26M51 18h26M92 18h26" stroke="#64748b"/><circle cx="33" cy="18" r="2" fill="{{A}}"/><circle cx="74" cy="18" r="2" fill="{{B}}"/><circle cx="95" cy="18" r="2" fill="#ef4444"/></g><text x="100" y="162" fill="#fef3c7" text-anchor="middle">KEYS HIDDEN · BODY SAFE OFF</text></g>`,
  skills: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g transform="translate(35 126)"><rect width="130" height="30" rx="3" fill="#100d1c" stroke="{{A}}"/><text x="7" y="9" fill="#94a3b8">MANIFEST</text><text x="43" y="9" fill="{{B}}">DRAFT R1</text><text x="7" y="17" fill="#94a3b8">SIM PLAN</text><text x="43" y="17" fill="{{A}}">0 EFFECTS</text><text x="7" y="25" fill="#94a3b8">SHA-256</text><text x="43" y="25" fill="#e2e8f0">8A4F…91C2</text><path d="M88 8h31M88 15h31M88 22h31" stroke="#475569"/><circle cx="124" cy="8" r="3" fill="#fbbf24"/><circle cx="124" cy="15" r="3" fill="#38bdf8"/><circle cx="124" cy="22" r="3" fill="#ef4444"/></g><text x="100" y="163" fill="#fca5a5" text-anchor="middle">LIFECYCLE · EXECUTION BLOCKED</text></g>`,
  procedures: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g transform="translate(33 125)"><rect width="134" height="32" rx="3" fill="#071713" stroke="{{A}}"/><g fill="#052e2b" stroke="{{A}}"><rect x="5" y="6" width="30" height="19"/><rect x="52" y="6" width="30" height="19"/></g><rect x="99" y="6" width="30" height="19" fill="#422006" stroke="{{B}}"/><text x="20" y="14" fill="{{A}}" text-anchor="middle">R3 × 3</text><text x="67" y="14" fill="{{A}}" text-anchor="middle">CANDIDATE</text><text x="114" y="14" fill="{{B}}" text-anchor="middle">R4 DRAFT</text><path d="M35 15h17m30 0h17" stroke="#e2e8f0"/><path d="m47 11 5 4-5 4m47-8 5 4-5 4" fill="none" stroke="#e2e8f0"/><text x="67" y="23" fill="#94a3b8" text-anchor="middle">REVIEW REQUIRED</text></g><text x="100" y="164" fill="#fca5a5" text-anchor="middle">DETECT · RETAIN · NEVER EXECUTE</text></g>`,
  overview: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g transform="translate(34 126)"><rect width="132" height="30" rx="3" fill="#071716" stroke="{{A}}"/><text x="7" y="9" fill="#94a3b8">AVAILABLE</text><text x="48" y="9" fill="{{A}}">07</text><text x="69" y="9" fill="#94a3b8">PLANNED</text><text x="108" y="9" fill="{{B}}">17</text><g transform="translate(7 15)"><rect width="115" height="7" rx="3.5" fill="#1e293b"/><rect width="38" height="7" rx="3.5" fill="{{A}}"/><path d="M46 0v7m24-7v7m24-7v7" stroke="#0f172a"/></g><circle cx="126" cy="19" r="4" fill="#4ade80"/></g><text x="100" y="163" fill="{{A}}" text-anchor="middle">24 CAPABILITIES · NATIVE SNAPSHOT</text></g>`,
  face: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g transform="translate(35 126)"><rect width="130" height="30" rx="3" fill="#1a0b18" stroke="{{A}}"/><text x="7" y="9" fill="#94a3b8">DEPENDENCIES</text><text x="58" y="9" fill="#ef4444">0 / 3</text><text x="7" y="18" fill="#94a3b8">CHANNELS</text><text x="58" y="18" fill="{{B}}">0 / 8</text><text x="7" y="27" fill="#94a3b8">PACKETS</text><text x="58" y="27" fill="#e2e8f0">0 · SAFE</text><g transform="translate(91 5)" stroke="{{A}}"><path d="M0 0h29v20H0zM5 5h19M5 10h13M5 15h21" fill="none"/><circle cx="24" cy="15" r="2" fill="{{B}}"/></g></g><text x="100" y="163" fill="#f9a8d4" text-anchor="middle">GAZE · SPEECH · EMOTION · BLINK</text></g>`,
  body: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g transform="translate(34 125)"><rect width="132" height="31" rx="3" fill="#1b1807" stroke="{{A}}"/><text x="6" y="9" fill="#94a3b8">STATE</text><text x="34" y="9" fill="{{B}}">IDLE</text><text x="6" y="18" fill="#94a3b8">MOTOR</text><text x="34" y="18" fill="{{A}}">READY</text><text x="6" y="27" fill="#94a3b8">INPUT</text><text x="34" y="27" fill="#e2e8f0">DUALSENSE</text><path d="M77 8h42M77 16h42M77 24h42" stroke="#475569"/><circle cx="83" cy="8" r="3" fill="#4ade80"/><circle cx="101" cy="16" r="3" fill="{{B}}"/><circle cx="116" cy="24" r="3" fill="#38bdf8"/></g><text x="100" y="164" fill="#fde68a" text-anchor="middle">IDLE → WALK → SIT → STAND</text></g>`,
  volume: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g transform="translate(35 126)"><rect width="130" height="29" rx="3" fill="#061724" stroke="{{A}}"/><text x="7" y="9" fill="#94a3b8">NODES</text><text x="35" y="9" fill="{{A}}">LOCAL</text><text x="7" y="18" fill="#94a3b8">MEMORY</text><text x="35" y="18" fill="{{B}}">10</text><text x="7" y="27" fill="#94a3b8">R3 SIGNAL</text><text x="45" y="27" fill="#4ade80">RECENT</text><g transform="translate(82 4)" fill="none" stroke="#475569"><path d="m0 18 12-14 13 10L38 1l11 15"/><g fill="{{A}}" stroke="none"><circle cx="0" cy="18" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="25" cy="14" r="2"/><circle cx="38" cy="1" r="2"/><circle cx="49" cy="16" r="2"/></g></g></g><text x="100" y="163" fill="{{A}}" text-anchor="middle">3D GRAPH · PERSISTENT + EPHEMERAL</text></g>`,
  flow: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g transform="translate(31 126)"><rect width="138" height="30" rx="3" fill="#100c1b" stroke="{{A}}"/><g fill="#1e1b4b" stroke="{{A}}"><circle cx="12" cy="15" r="7"/><circle cx="39" cy="15" r="7"/><circle cx="66" cy="15" r="7"/></g><g fill="#4a1638" stroke="{{B}}"><circle cx="93" cy="15" r="7"/><circle cx="120" cy="15" r="7"/></g><path d="M19 15h13m14 0h13m14 0h13m14 0h13" stroke="#e2e8f0"/><text x="12" y="17" fill="#fff" text-anchor="middle">IN</text><text x="39" y="17" fill="#fff" text-anchor="middle">MEM</text><text x="66" y="17" fill="#fff" text-anchor="middle">AFF</text><text x="93" y="17" fill="#fff" text-anchor="middle">WS</text><text x="120" y="17" fill="#fff" text-anchor="middle">OUT</text></g><text x="100" y="163" fill="#e9d5ff" text-anchor="middle">EVIDENCED LINKS ONLY</text></g>`,
  state: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g transform="translate(34 126)"><rect width="132" height="30" rx="3" fill="#071713" stroke="{{A}}"/><text x="7" y="9" fill="#94a3b8">SIGNALS</text><text x="51" y="9" fill="{{A}}">R3</text><text x="7" y="18" fill="#94a3b8">MEMORY</text><text x="51" y="18" fill="{{B}}">LOCAL</text><text x="7" y="27" fill="#94a3b8">BEHAVIOR</text><text x="51" y="27" fill="#ef4444">LOCKED</text><g transform="translate(79 5)"><path d="M0 5h44M0 13h44M0 21h44" stroke="#334155" stroke-width="4"/><path d="M0 5h29M0 13h17" stroke="{{A}}" stroke-width="4"/><circle cx="29" cy="5" r="3" fill="#d1fae5"/><circle cx="17" cy="13" r="3" fill="#fef3c7"/><path d="m19 18 7 7m0-7-7 7" stroke="#ef4444"/></g></g></g>`,
  planner: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><g transform="translate(34 126)"><rect width="132" height="31" rx="3" fill="#1b1407" stroke="{{A}}"/><text x="6" y="9" fill="#94a3b8">INTENTION</text><text x="48" y="9" fill="#ef4444">—</text><text x="6" y="18" fill="#94a3b8">UTILITY</text><text x="48" y="18" fill="#ef4444">—</text><text x="6" y="27" fill="#94a3b8">RISK / NOVELTY</text><text x="63" y="27" fill="#ef4444">— / —</text><g transform="translate(82 5)" fill="#111827" stroke="#475569"><rect width="43" height="21"/><path d="M5 6h33M5 11h25M5 16h18"/><circle cx="36" cy="16" r="3" fill="{{B}}" stroke="none"/></g></g><text x="100" y="164" fill="#fca5a5" text-anchor="middle">NO CANDIDATE · NO DECISION</text></g>`,
  pan: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><rect x="43" y="134" width="114" height="22" rx="3" fill="#071521" stroke="{{A}}"/><text x="50" y="143" fill="#94a3b8">X</text><text x="61" y="143" fill="{{A}}">0.00</text><text x="91" y="143" fill="#94a3b8">Y</text><text x="102" y="143" fill="{{B}}">0.00</text><path d="M50 150h99" stroke="#334155"/><circle cx="100" cy="150" r="3" fill="#fff"/></g>`,
  reset: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><rect x="43" y="134" width="114" height="22" rx="3" fill="#130d20" stroke="{{A}}"/><text x="50" y="143" fill="#94a3b8">CAMERA HOME</text><text x="50" y="151" fill="{{B}}">POS 0 · ROT 0 · ZOOM 100%</text><circle cx="146" cy="145" r="5" fill="#4ade80"/></g>`,
  rotate: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><rect x="43" y="134" width="114" height="22" rx="3" fill="#071521" stroke="{{A}}"/><text x="50" y="143" fill="#94a3b8">ORBIT</text><text x="74" y="143" fill="{{A}}">X 0°</text><text x="101" y="143" fill="{{B}}">Y 0°</text><path d="M50 151h99" stroke="#334155"/><path d="M88 151h24" stroke="{{A}}" stroke-width="3"/></g>`,
  zoomin: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><rect x="43" y="134" width="114" height="22" rx="3" fill="#071713" stroke="{{A}}"/><text x="50" y="143" fill="#94a3b8">ZOOM LEVEL</text><text x="127" y="143" fill="{{A}}">100%</text><path d="M50 151h99" stroke="#334155" stroke-width="4"/><path d="M50 151h68" stroke="{{A}}" stroke-width="4"/><circle cx="118" cy="151" r="4" fill="#fff"/></g>`,
  zoomout: `<g font-family="Consolas,monospace" font-size="5" font-weight="900"><rect x="43" y="134" width="114" height="22" rx="3" fill="#1b1008" stroke="{{A}}"/><text x="50" y="143" fill="#94a3b8">ZOOM LEVEL</text><text x="127" y="143" fill="{{A}}">100%</text><path d="M50 151h99" stroke="#422006" stroke-width="4"/><path d="M50 151h68" stroke="{{A}}" stroke-width="4"/><circle cx="118" cy="151" r="4" fill="#fff"/></g>`,
};

function render([file, id, title, accent, secondary, rawBody]) {
  const body = rawBody.replaceAll("{{A}}", accent).replaceAll("{{B}}", secondary);
  const detail = semanticDetails[id].replaceAll("{{A}}", accent).replaceAll("{{B}}", secondary);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${title}">
  <title>${title}</title>
  <style>
    .${id}-orbit{animation:${id}Orbit 4s linear infinite}.${id}-pulse{animation:${id}Pulse 1.8s ease-in-out infinite}.${id}-scan{animation:${id}Scan 3s ease-in-out infinite}
    @keyframes ${id}Orbit{to{stroke-dashoffset:-42}}@keyframes ${id}Pulse{50%{opacity:.3}}@keyframes ${id}Scan{0%,100%{transform:translateX(-7px);opacity:.18}50%{transform:translateX(7px);opacity:.8}}
    @media (prefers-reduced-motion:reduce){.${id}-orbit,.${id}-pulse,.${id}-scan{animation:none}}
  </style>
  <defs>
    <radialGradient id="${id}-base" cx="42%" cy="32%" r="75%"><stop stop-color="#263442"/><stop offset=".48" stop-color="#101923"/><stop offset="1" stop-color="#03070b"/></radialGradient>
    <linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#94a3b8"/><stop offset=".35" stop-color="#334155"/><stop offset=".7" stop-color="#111827"/><stop offset="1" stop-color="#020617"/></linearGradient>
    <linearGradient id="${id}-accent" x1="0" x2="1"><stop stop-color="${accent}"/><stop offset=".52" stop-color="#f8fafc"/><stop offset="1" stop-color="${secondary}"/></linearGradient>
    <radialGradient id="${id}-holo"><stop stop-color="#fff"/><stop offset=".18" stop-color="${accent}"/><stop offset=".68" stop-color="${secondary}"/><stop offset="1" stop-color="#07111d"/></radialGradient>
    <pattern id="${id}-grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0v12" fill="none" stroke="${accent}" stroke-width=".45" opacity=".22"/></pattern>
    <filter id="${id}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="${id}-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#000" flood-opacity=".8"/></filter>
    <linearGradient id="${id}-beam" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${accent}" stop-opacity=".28"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient>
  </defs>
  <path d="M100 8C178 8 192 22 192 100S178 192 100 192 8 178 8 100 22 8 100 8Z" fill="#070a0f"/>
  <path d="M100 13c72 0 82 15 82 87s-10 87-82 87-82-15-82-87 10-87 82-87Z" fill="url(#${id}-base)" stroke="#475569" stroke-width="1.5"/>
  <path d="M100 19c66 0 76 14 76 81s-10 81-76 81-76-14-76-81 10-81 76-81Z" fill="url(#${id}-grid)" stroke="${accent}" stroke-width=".8" opacity=".78"/>
  <path d="M100 24c57 0 71 10 75 57L25 81c4-47 18-57 75-57Z" fill="url(#${id}-beam)"/>
  <circle class="${id}-orbit" cx="100" cy="100" r="71" fill="none" stroke="${accent}" stroke-width=".7" stroke-dasharray="7 5" opacity=".45"/><circle class="${id}-orbit" cx="100" cy="100" r="62" fill="none" stroke="${secondary}" stroke-width=".6" stroke-dasharray="2 6" opacity=".38"/>
  <path d="M48 34h18l7 7m79-7h-18l-7 7M48 166h18l7-7m79 7h-18l-7-7" fill="none" stroke="${accent}" stroke-width="1" opacity=".65"/>
  <g fill="url(#${id}-metal)" stroke="#020617"><circle cx="30" cy="30" r="5"/><circle cx="170" cy="30" r="5"/><circle cx="30" cy="170" r="5"/><circle cx="170" cy="170" r="5"/></g>
  <g stroke="#cbd5e1" stroke-width=".8" opacity=".75"><path d="M27 30h6m-3-3v6M167 30h6m-3-3v6M27 170h6m-3-3v6M167 170h6m-3-3v6"/></g>
  <g fill="${accent}" filter="url(#${id}-glow)"><circle cx="48" cy="28" r="2"/><circle cx="152" cy="172" r="2"/></g><g fill="${secondary}"><circle cx="152" cy="28" r="1.5"/><circle cx="48" cy="172" r="1.5"/></g>
  <path d="M48 22Q100 11 152 22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".12"/>
  <g font-family="Consolas,monospace" font-weight="900"><text x="100" y="28" fill="${accent}" font-size="7" text-anchor="middle" letter-spacing="1.5">${id.toUpperCase()} · ALICE</text><text x="100" y="176" fill="#64748b" font-size="5" text-anchor="middle" letter-spacing="1">LOCAL · VERIFIED</text></g>
  <g transform="translate(14 65)" fill="#07111e" stroke="${accent}" stroke-width=".8"><path d="M0 0h22l4 5v25l-4 5H0z"/><path d="M5 8h14M5 14h10M5 20h14M5 26h7" stroke="${accent}"/><circle class="${id}-pulse" cx="19" cy="27" r="2" fill="${secondary}" stroke="none"/></g>
  <g transform="translate(160 65)" fill="#07111e" stroke="${secondary}" stroke-width=".8"><path d="M4 0h22v35H4l-4-5V5z"/><path d="M8 8h14M12 14h10M8 20h14M15 26h7" stroke="${secondary}"/><circle class="${id}-pulse" cx="8" cy="27" r="2" fill="${accent}" stroke="none"/></g>
  ${body.trim()}
  ${detail.trim()}
  <g class="${id}-scan" stroke="${secondary}" stroke-width=".8" opacity=".55"><path d="M52 58h96M52 100h96M52 142h96"/></g>
  <g opacity=".65" stroke="${accent}" stroke-width="1"><path d="M24 108h10l5 5h8M176 108h-10l-5 5h-8" fill="none"/><path d="M24 113h15M176 113h-15"/></g>
  <g transform="translate(63 181)"><rect width="74" height="5" rx="2.5" fill="#020617" stroke="#334155" stroke-width=".7"/><rect x="2" y="1.5" width="46" height="2" rx="1" fill="${accent}"/><circle cx="58" cy="2.5" r="1.5" fill="${secondary}"/><circle cx="66" cy="2.5" r="1.5" fill="#4ade80"/></g>
</svg>\n`;
}

const generatedIcons = icons.filter(([file]) => !handAuthoredIcons.has(file));
for (const icon of generatedIcons) writeFileSync(join(root, icon[0]), render(icon), "utf8");
console.log(`Generated ${generatedIcons.length} original Alice SVG icons; preserved ${handAuthoredIcons.size} hand-authored icons.`);
