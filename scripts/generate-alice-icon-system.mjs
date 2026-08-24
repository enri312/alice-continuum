import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../icons/", import.meta.url));
// Estos SVG son componentes funcionales diseñados y revisados individualmente.
// El generador histórico queda disponible como referencia, pero no debe borrar
// detalles contextuales, estados honestos ni correcciones visuales aprobadas.
const handAuthoredIcons = new Set([
  "bridge-body.svg", "bridge-face.svg", "bridge-overview.svg",
  "nav-activity.svg", "nav-audit.svg", "nav-avatar.svg", "nav-bridges.svg",
  "nav-conversation.svg", "nav-identification.svg", "nav-memory.svg",
  "nav-nucleus.svg", "nav-procedures.svg", "nav-settings.svg", "nav-skills.svg",
  "nucleus-flow.svg", "nucleus-planner.svg", "nucleus-state.svg", "nucleus-volume.svg",
  "view-pan.svg", "view-reset.svg", "view-rotate.svg", "view-zoom-in.svg", "view-zoom-out.svg",
]);

const screens = [
  ["nav-conversation.svg", "conversation", "Conversación", "#22d3ee", "#34d399", "DIALOGUE", `
    <g filter="url(#{{id}}-shadow)"><rect x="40" y="56" width="68" height="56" rx="3" fill="#071521" stroke="{{A}}" stroke-width="1.2"/></g>
    <path d="M40 64h68" stroke="#164e63"/><circle cx="45" cy="60" r="1.3" fill="#f87171"/><circle cx="50" cy="60" r="1.3" fill="#fbbf24"/><circle cx="55" cy="60" r="1.3" fill="#34d399"/>
    <path class="{{id}}-dash" d="M46 74h48M46 82h38M46 90h44" stroke="#ccfbf1" stroke-width="2" stroke-linecap="round" stroke-dasharray="9 4" opacity=".85"/>
    <g class="{{id}}-blink" fill="{{A}}"><circle cx="47" cy="101" r="1.7"/><circle cx="54" cy="101" r="1.7"/><circle cx="61" cy="101" r="1.7"/></g>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.6">
      <g fill="#061827" stroke="#475569"><rect x="112" y="56" width="48" height="9" rx="2"/><rect x="112" y="68" width="48" height="9" rx="2"/><rect x="112" y="80" width="48" height="9" rx="2"/></g>
      <rect x="115" y="58.5" width="4" height="4" fill="none" stroke="#64748b"/><rect x="115" y="70.5" width="4" height="4" fill="none" stroke="#64748b"/><rect x="115" y="82.5" width="4" height="4" fill="none" stroke="#64748b"/>
      <text x="122" y="63" fill="#94a3b8">HIST</text><text x="122" y="75" fill="#94a3b8">MEM</text><text x="122" y="87" fill="#94a3b8">VENT</text>
      <rect x="112" y="92" width="48" height="9" rx="2" fill="#052e2b" stroke="{{B}}"/><rect x="115" y="94.5" width="4" height="4" fill="{{B}}"/><text x="122" y="99" fill="#a7f3d0">EPS ON</text>
    </g>
    <g filter="url(#{{id}}-shadow)"><path d="M112 106h36l7 7-7 7h-36l-6-7Z" fill="#111827" stroke="#fbbf24" stroke-width="1.1"/></g>
    <path d="M120 112v-1.6a2.4 2.4 0 0 1 4.8 0V112" fill="none" stroke="#fde68a"/><rect x="118.5" y="112" width="8" height="6" rx="1.2" fill="url(#{{id}}-gb)" stroke="#fde68a" stroke-width=".7"/>
    <g font-family="Consolas,monospace" font-weight="900"><text x="132" y="116" fill="#fcd34d" font-size="4">GATE</text></g>
    <g transform="translate(50 127)"><circle r="7" fill="#07111e" stroke="#64748b" stroke-dasharray="3 3"/><rect x="-2.6" y="-5" width="5.2" height="8" rx="2.6" fill="#1e293b" stroke="#94a3b8" stroke-width=".8"/><path d="m-5-5 10 10" stroke="#f87171" stroke-width="1.6"/></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="60" y="130" fill="#fca5a5" font-size="3.8">SAFE OFF</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="160" y="121.5" fill="#64748b" font-size="3" text-anchor="end">REV → AUTH → SEND · 0 CHARS</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="145" fill="#475569" font-size="3">R6.2 · RAM</text></g>
    <rect x="92" y="124" width="68" height="7" rx="3.5" fill="#020617" stroke="#334155"/><rect x="94" y="126" width="10" height="3" rx="1.5" fill="{{A}}"/>
    <g font-family="Consolas,monospace" font-weight="900"><text x="92" y="138" fill="#64748b" font-size="3.6">PREVIEW · 0 B OUT</text><text x="160" y="138" fill="#64748b" font-size="3.6" text-anchor="end">MODEL · READONLY</text></g>`],
  ["nav-avatar.svg", "avatar", "Avatar", "#f472b6", "#38bdf8", "AVATAR", `
    <g filter="url(#{{id}}-shadow)"><rect x="40" y="56" width="70" height="64" rx="3" fill="#0d0a14" stroke="{{A}}" stroke-width="1.2"/></g>
    <circle cx="46" cy="62" r="1.6" fill="#4ade80" class="{{id}}-blink" filter="url(#{{id}}-glow)"/>
    <g font-family="Consolas,monospace" font-weight="900"><text x="51" y="64" fill="#4ade80" font-size="3.6">MODELO CARGADO</text><text x="106" y="64" fill="#64748b" font-size="3.2" text-anchor="end">ALICE · AVATAR</text></g>
    <g><circle cx="75" cy="82" r="5" fill="url(#{{id}}-halo)" stroke="#cbd5e1" stroke-width=".9"/>
      <path d="M70 88h10l2 12-3 9h-8l-3-9Z" fill="#1f2937" stroke="#64748b" stroke-width=".9"/>
      <path d="M70 89l-5 3-1 9M80 89l5 3 1 9" fill="none" stroke="#273448" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M72 109l-1 6M78 109l1 6" fill="none" stroke="#101722" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M68 90c-3 6-3 12-1 18M82 90c3 6 3 12 1 18" fill="none" stroke="{{A}}" stroke-width=".8" opacity=".8" stroke-dasharray="4 3" class="{{id}}-dash"/>
    </g>
    <g fill="#fff" stroke="{{B}}" stroke-width=".6"><circle cx="70" cy="89" r=".9"/><circle cx="80" cy="89" r=".9"/><circle cx="64" cy="101" r=".9"/><circle cx="86" cy="101" r=".9"/><circle cx="71" cy="109" r=".9"/><circle cx="79" cy="109" r=".9"/></g>
    <ellipse cx="75" cy="117" rx="16" ry="3.4" fill="none" stroke="{{B}}" stroke-width=".8" stroke-dasharray="5 4" class="{{id}}-dash"/>
    <g transform="translate(94 116) scale(.8)" fill="#172536" stroke="#93c5fd" stroke-width=".9"><path d="M0 0c1.5-4 5.5-5 9-2.5l2.5 2.5h9l2.5-2.5c3.5-2.5 7.5-1.5 9 2.5l-3 4-5-1.5h-14l-5 1.5z"/></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="108" y="106" fill="#64748b" font-size="3.2" text-anchor="end">TEST 10s</text><text x="108" y="112" fill="#64748b" font-size="3.2" text-anchor="end">MANUAL · R3</text></g>
    <g filter="url(#{{id}}-shadow)"><path d="M114 56h46v64h-46l-4-6V62Z" fill="#100d1c" stroke="{{B}}"/></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="118" y="63" fill="#c4b5fd" font-size="3.8">INSPECTOR VRM</text></g>
    <path d="M118 66h38" stroke="#312e81" stroke-width=".7"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.2">
      <text x="118" y="72" fill="#64748b">HUESOS</text><rect x="144" y="69.6" width="12" height="2.4" fill="#164e63"/><rect x="144" y="69.6" width="8" height="2.4" fill="{{B}}" class="{{id}}-blink2"/>
      <text x="118" y="79" fill="#64748b">EXPR</text><text x="156" y="79" fill="#e0f2fe" text-anchor="end">14</text>
      <text x="118" y="86" fill="#64748b">SPRINGS</text><rect x="144" y="83.6" width="12" height="2.4" fill="#3b0764"/><rect x="144" y="83.6" width="6" height="2.4" fill="{{A}}" class="{{id}}-blink2"/>
      <text x="118" y="93" fill="#64748b">CLIPS</text><text x="156" y="93" fill="#e0f2fe" text-anchor="end">12</text>
    </g>
    <path d="M118 97h38" stroke="#312e81" stroke-width=".7"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="2.8"><text x="118" y="102" fill="#64748b">FACIAL · SOLO LECTURA</text><text x="118" y="107" fill="#475569">LICENCIA · PRIVADA</text></g>
    <path d="M150 103h5v4.5h-5Zm1-.9v-1.4a1.6 1.6 0 0 1 3.2 0v1.4" fill="none" stroke="#94a3b8" stroke-width=".7"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.2">
      <rect x="40" y="126" width="29" height="10" rx="2" fill="#052e2b" stroke="#4ade80" stroke-width=".7"/><circle cx="45" cy="131" r="1.4" fill="#4ade80" class="{{id}}-blink2"/><text x="49" y="133" fill="#a7f3d0">01 RENDER</text>
      <rect x="71" y="126" width="29" height="10" rx="2" fill="#0b1320" stroke="#475569" stroke-width=".7"/><text x="76" y="133" fill="#64748b">02 EXPR</text>
      <rect x="102" y="126" width="29" height="10" rx="2" fill="#0b1320" stroke="#475569" stroke-width=".7"/><text x="107" y="133" fill="#64748b">03 VOZ</text>
      <rect x="133" y="126" width="27" height="10" rx="2" fill="#0b1320" stroke="#475569" stroke-width=".7"/><text x="137" y="133" fill="#64748b">04 RAGDOLL</text>
    </g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="100" y="146" fill="#64748b" font-size="3.6" text-anchor="middle">ALICE.VRM · LOCAL · PRIVATE</text></g>`],
  ["nav-nucleus.svg", "nucleus", "Núcleo cognitivo", "#fbbf24", "#22d3ee", "CORE", `
    <g filter="url(#{{id}}-shadow)"><circle cx="56" cy="76" r="11" fill="#0b1d29" stroke="{{B}}"/><circle cx="56" cy="112" r="11" fill="#0b1d29" stroke="{{B}}"/>    <circle cx="92" cy="94" r="13" fill="url(#{{id}}-halo)" stroke="#fff7c2"/>
    <g font-family="Consolas,monospace" font-weight="900"><text x="92" y="79" fill="#64748b" font-size="3" text-anchor="middle">5/7 REG</text></g><circle cx="126" cy="76" r="11" fill="#1a1207" stroke="{{A}}"/></g>
    <circle cx="126" cy="112" r="11" fill="#141024" stroke="#f472b6"/>
    <path d="M110 60v68" stroke="#475569" stroke-width=".8" stroke-dasharray="3 3"/>
    <g fill="none" stroke-width="1.3"><path class="{{id}}-dash" d="M66 80q12 6 15 8M66 108q12-6 15-8M104 90q10-8 13-9" stroke="{{B}}" stroke-dasharray="4 3"/><path class="{{id}}-dash" d="M104 98q10 8 13 9" stroke="{{A}}" stroke-dasharray="4 3"/></g>
    <g font-family="Consolas,monospace" font-weight="900" font-size="2.8" fill="#64748b"><text x="74" y="82">×2</text><text x="74" y="112">×1</text><text x="112" y="88">×1</text><text x="112" y="106">×1</text></g>
    <g class="{{id}}-blink" fill="#fff"><circle cx="56" cy="76" r="2.4"/><circle cx="56" cy="112" r="2.4"/><circle cx="92" cy="94" r="2.8"/><circle cx="126" cy="76" r="2.4"/></g>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.6"><text x="56" y="93" fill="{{B}}" text-anchor="middle">ENTRADA</text><text x="56" y="129" fill="{{B}}" text-anchor="middle">CONTEXTO</text><text x="126" y="93" fill="{{A}}" text-anchor="middle">SALIDA</text><text x="126" y="129" fill="#f9a8d4" text-anchor="middle">MOTOR · MAN</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><rect x="40" y="134" width="52" height="9" rx="2" fill="#0b1320" stroke="{{A}}" stroke-width=".8"/><text x="66" y="140.5" fill="#fde68a" font-size="3.6" text-anchor="middle">7 REG · 5 LINKS</text><rect x="108" y="134" width="52" height="9" rx="2" fill="#0b1320" stroke="{{B}}" stroke-width=".8"/><text x="134" y="140.5" fill="#a5f3fc" font-size="3.6" text-anchor="middle">R3 · 5 MIN</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="148" fill="#475569" font-size="3">R3 CORE</text></g>`],
  ["nav-memory.svg", "memory", "Memoria", "#60a5fa", "#a78bfa", "VAULT", `
    <g filter="url(#{{id}}-shadow)"><circle cx="68" cy="94" r="30" fill="#0b1420" stroke="{{A}}" stroke-width="2.6"/></g>
    <circle cx="68" cy="94" r="22" fill="#16202e" stroke="#cbd5e1" stroke-width="1.4"/>
    <g stroke="#94a3b8" stroke-width="2.4" stroke-linecap="round"><path d="M68 94V79M68 94l13 7.5M68 94l-13 7.5"/></g>
    <circle cx="68" cy="94" r="4.5" fill="#1f2937" stroke="#cbd5e1" stroke-width="1.6"/>
    <g fill="#334155" stroke="#94a3b8" stroke-width=".8"><circle cx="68" cy="70" r="2"/><circle cx="85" cy="77" r="2"/><circle cx="92" cy="94" r="2"/><circle cx="85" cy="111" r="2"/><circle cx="68" cy="118" r="2"/><circle cx="51" cy="111" r="2"/><circle cx="44" cy="94" r="2"/><circle cx="51" cy="77" r="2"/></g>
    <g filter="url(#{{id}}-shadow)"><rect x="106" y="58" width="54" height="13" rx="2" fill="#101c2b" stroke="{{A}}"/><rect x="106" y="75" width="54" height="13" rx="2" fill="#101c2b" stroke="{{A}}"/><rect x="106" y="92" width="54" height="13" rx="2" fill="#101c2b" stroke="{{B}}"/></g>
    <path d="M110 64h34M110 68h26M110 81h34M110 85h26M110 98h34M110 102h26" stroke="#64748b" stroke-width="1.2"/>
    <circle class="{{id}}-blink" cx="154" cy="64" r="1.8" fill="{{B}}"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.4"><rect x="106" y="110" width="54" height="10" rx="2" fill="#0b1320" stroke="{{B}}" stroke-width=".8"/><text x="133" y="117" fill="#c4b5fd" text-anchor="middle">RAM 3/6 · TTL 30'</text></g>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.4"><text x="42" y="132" fill="#93c5fd">EPI 9</text><text x="58" y="132" fill="#c4b5fd">SEM 0</text><text x="74" y="132" fill="#a7f3d0">PROC 1</text><text x="92" y="132" fill="#94a3b8">WORK 0</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><rect x="106" y="124" width="54" height="12" rx="2" fill="#07111e" stroke="{{A}}" stroke-width=".8"/><text x="133" y="132" fill="#93c5fd" font-size="3.6" text-anchor="middle">10 REC · SHA OK</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="146" fill="#475569" font-size="3">BAK OK</text><text x="100" y="146" fill="#64748b" font-size="3.6" text-anchor="middle">KEEP SEPARATE · LAYER INDEX v2</text></g>`],
  ["nav-activity.svg", "activity", "Actividad", "#84cc16", "#22d3ee", "R3 LIVE", `
    <g filter="url(#{{id}}-shadow)"><rect x="40" y="56" width="120" height="74" rx="3" fill="#06160f" stroke="{{A}}" stroke-width="1.3"/></g>
    <path d="M40 65h120" stroke="#285139"/>
    <g font-family="Consolas,monospace" font-weight="900"><text x="45" y="62.5" fill="#d9f99d" font-size="4.2">LIVE EVENT WINDOW</text><text x="155" y="62.5" fill="#64748b" font-size="3.6" text-anchor="end">5 MIN</text></g>
    <circle cx="141" cy="61" r="3" fill="none" stroke="{{B}}" stroke-width=".9"/><path d="M141 61v-1.8m0 1.8 1.6 1.1" stroke="{{B}}" stroke-width=".8" stroke-linecap="round"/>
    <g fill="{{B}}"><circle cx="47" cy="74" r="2.2"/><circle cx="47" cy="90" r="2.2"/><circle cx="47" cy="106" r="2.2"/><circle cx="47" cy="122" r="2.2"/></g>
    <path class="{{id}}-dash" d="M54 74h14l4-5 7 10 7-16 8 18 6-7h52M54 90h12l5-4 7 8 8-11 8 8h56M54 106h10l6-6 8 10 6-7 8 3h58M54 122h13l5-5 8 9 7-10 8 7h55" fill="none" stroke="{{A}}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#{{id}}-glow)"/>
    <g><circle cx="152" cy="74" r="2.4" fill="#4ade80"/><circle cx="152" cy="90" r="2.4" fill="#38bdf8" class="{{id}}-blink"/><circle cx="152" cy="106" r="2.4" fill="#fbbf24"/><circle cx="152" cy="122" r="2.4" fill="#f87171"/></g>
    <path d="M44 74v16m0 0h-3m3 0h3" stroke="#64748b" stroke-width=".8" fill="none"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.2" fill="#475569"><text x="54" y="80">op:A3F9</text><text x="54" y="96">op:A3F9</text><text x="54" y="112">op:C210</text><text x="54" y="128">op:E77B</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="100" y="141" fill="{{A}}" font-size="3.9" text-anchor="middle">TIMELINE · EVENT STREAM · R3</text><text x="160" y="141" fill="#64748b" font-size="3" text-anchor="end">OK·PEND·BLK·ERR</text></g>`],
  ["nav-audit.svg", "audit", "Auditoría y diagnóstico", "#fb7185", "#60a5fa", "FORENSIC", `
    <circle cx="100" cy="90" r="38" fill="none" stroke="{{B}}" stroke-width=".9" stroke-dasharray="4 5" class="{{id}}-dash" opacity=".55"/>
    <g stroke="#475569" stroke-width=".8"><path d="M100 48v5M142 90h-5M100 132v-5M58 90h5"/></g>
    <g filter="url(#{{id}}-shadow)"><path d="M100 56l28 9v20c0 19-12 30-28 37-16-7-28-18-28-37V65Z" fill="#170b12" stroke="{{A}}" stroke-width="2.4" stroke-linejoin="round"/></g>
    <path d="m88 88 8 8 16-18" fill="none" stroke="#4ade80" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#{{id}}-glow)"/>
    <rect class="{{id}}-scan" x="74" y="60" width="52" height="1.2" fill="{{A}}" opacity=".5"/>
    <g fill="#475569"><rect x="80" y="116" width="6" height="2"/><rect x="88" y="116" width="4" height="2"/><rect x="94" y="116" width="7" height="2"/><rect x="103" y="116" width="4" height="2"/><rect x="109" y="116" width="6" height="2"/></g>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.4">
      <text x="40" y="70" fill="#94a3b8">INTEGRITY</text><circle cx="66" cy="68" r="2" fill="#4ade80" class="{{id}}-blink"/>
      <text x="40" y="82" fill="#94a3b8">DIAGNOSTIC</text><circle cx="66" cy="80" r="2" fill="{{B}}"/>
      <text x="40" y="94" fill="#94a3b8">EFFECTS</text><circle cx="66" cy="92" r="2" fill="#64748b"/>
    </g>
    <g><circle cx="136" cy="68" r="2.2" fill="#4ade80"/><path d="M140 68h18" stroke="#2d3b4b" stroke-width="1.6"/>
      <circle cx="136" cy="80" r="2.2" fill="#38bdf8" class="{{id}}-blink"/><path d="M140 80h18" stroke="#2d3b4b" stroke-width="1.6"/>
      <circle cx="136" cy="92" r="2.2" fill="#fbbf24"/><path d="M140 92h18" stroke="#2d3b4b" stroke-width="1.6"/>
      <circle cx="136" cy="104" r="2.2" fill="#f87171"/><path d="M140 104h18" stroke="#2d3b4b" stroke-width="1.6"/></g>
    <path d="M132 68v36m0 0h-2m2 0h2" stroke="#64748b" stroke-width=".8" fill="none"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.2" fill="#64748b"><text x="136" y="114">OP-ID LINK</text><text x="136" y="119">×4 OP</text></g>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.4">
      <rect x="40" y="124" width="38" height="9" rx="2" fill="#07111e" stroke="#4ade80" stroke-width=".7"/><text x="59" y="130.5" fill="#a7f3d0" text-anchor="middle">HEALTHY</text>
      <rect x="81" y="124" width="38" height="9" rx="2" fill="#07111e" stroke="{{B}}" stroke-width=".7"/><text x="100" y="130.5" fill="#bfdbfe" text-anchor="middle">PASSIVE</text>
      <rect x="122" y="124" width="38" height="9" rx="2" fill="#07111e" stroke="{{A}}" stroke-width=".7"/><text x="141" y="130.5" fill="#fda4af" text-anchor="middle">5 MiB · 1 ROT</text>
    </g>
    <g font-family="Consolas,monospace" font-weight="900"><path d="m40 139 3 3 6-7" fill="none" stroke="#4ade80" stroke-width="1.8"/><text x="52" y="142" fill="#bfdbfe" font-size="3.8">SHA-256 OK</text><text x="160" y="142" fill="#64748b" font-size="3.2" text-anchor="end">8A4F…91C2</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="149" fill="#475569" font-size="3">228 EV</text><text x="100" y="149" fill="{{A}}" font-size="3.8" text-anchor="middle">VERIFY · TRACE · DIAGNOSE</text></g>`],
  ["nav-bridges.svg", "bridges", "Puentes corporales", "#38bdf8", "#fb923c", "BRIDGES", `
    <g filter="url(#{{id}}-shadow)">
      <g transform="translate(58 84)"><path d="M-14-8 0-15l14 7L0-1z" fill="#164e63" stroke="{{A}}"/><path d="M-14-8 0-1v21l-14-7z" fill="#082f49"/><path d="M14-8 0-1v21l14-7z" fill="#0c4a6e"/><circle cy="-10" r="2.6" fill="{{A}}"/></g>
      <g transform="translate(142 84)"><path d="M-14-8 0-15l14 7L0-1z" fill="#7c2d12" stroke="{{B}}"/><path d="M-14-8 0-1v21l-14-7z" fill="#431407"/><path d="M14-8 0-1v21l14-7z" fill="#7c2d12"/><circle cy="-10" r="2.6" fill="{{B}}"/></g>
    </g>
    <path class="{{id}}-dash" d="M66 70Q100 54 134 70" fill="none" stroke="url(#{{id}}-ga)" stroke-width="1.8" stroke-dasharray="6 4" filter="url(#{{id}}-glow)"/>
    <circle class="{{id}}-blink" cx="100" cy="62" r="3" fill="#fff"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.6"><text x="58" y="104" fill="{{A}}" text-anchor="middle">MENTE</text><text x="142" y="104" fill="{{B}}" text-anchor="middle">CUERPO</text></g>
    <path d="M46 108h4l2-3 3 5 2-4 3 3h4" stroke="{{A}}" stroke-width=".8" fill="none" opacity=".7"/><path d="M130 108h4l2-3 3 5 2-4 3 3h4" stroke="{{B}}" stroke-width=".8" fill="none" opacity=".7"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.4">
      <g fill="#0b1320" stroke="#475569"><rect x="42" y="112" width="116" height="9" rx="2"/><rect x="42" y="124" width="116" height="9" rx="2"/></g>
      <circle cx="48" cy="116.5" r="1.8" fill="#fbbf24" class="{{id}}-blink2"/><text x="54" y="119" fill="#94a3b8">CAM / MIC · PARTIAL</text><text x="152" y="119" fill="#fde68a" text-anchor="end">LEASE 60s</text>
      <circle cx="48" cy="128.5" r="1.8" fill="#64748b"/><text x="54" y="131" fill="#64748b">VOZ · ROSTRO · CUERPO</text><text x="152" y="131" fill="#64748b" text-anchor="end">PLANNED</text>
    </g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="142" fill="#475569" font-size="3">25 CAPS</text><text x="100" y="142" fill="#fca5a5" font-size="3.8" text-anchor="middle">REGISTRY · PROBES · SAFE OFF</text></g>`],
  ["nav-identification.svg", "identification", "Identificación", "#0ea5e9", "#10b981", "INPUT", `
    <g filter="url(#{{id}}-shadow)"><rect x="42" y="58" width="72" height="52" rx="4" fill="#082332" stroke="{{A}}" stroke-width="1.3"/><rect x="46" y="62" width="64" height="44" rx="2" fill="#0c3444" stroke="#7dd3fc" stroke-width=".6"/></g>
    <circle cx="58" cy="76" r="8" fill="#24475a" stroke="#bae6fd"/><path d="M50 92q2-8 8-8t8 8" fill="#17394a" stroke="{{A}}"/>
    <path d="M72 70h34M72 77h26M72 84h32M72 91h24" stroke="#bae6fd" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M46 62v6m0-6h6M110 62h-6m6 0v6M46 106v-6m0 6h6M110 106h-6m6 0v-6" fill="none" stroke="{{B}}" stroke-width="1.2"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.4">
      <text x="120" y="64" fill="#94a3b8">SOURCE</text><text x="158" y="64" fill="{{B}}" text-anchor="end">LOCAL</text>
      <text x="120" y="73" fill="#94a3b8">SPEAKER</text><text x="158" y="73" fill="#e2e8f0" text-anchor="end">OWNER</text>
      <text x="120" y="82" fill="#94a3b8">INTENT</text><text x="158" y="82" fill="{{A}}" text-anchor="end">PENDING</text>
    </g>
    <rect x="120" y="88" width="38" height="6" rx="3" fill="#020617" stroke="#334155"/><rect x="122" y="90" width="24" height="2" rx="1" fill="url(#{{id}}-ga)"/><circle class="{{id}}-blink" cx="148" cy="91" r="1.8" fill="{{B}}"/>
    <g font-family="Consolas,monospace" font-weight="900"><text x="120" y="103" fill="#64748b" font-size="3.4">CONF 0.00</text><circle cx="152" cy="100" r="4.4" fill="{{B}}" filter="url(#{{id}}-glow)"/><path d="m150 100 1.6 1.6 3.4-3.8" fill="none" stroke="#052e25" stroke-width="1.4"/></g>
    <g font-family="Consolas,monospace" font-weight="900"><rect x="42" y="118" width="116" height="12" rx="2" fill="#07111e" stroke="{{A}}" stroke-width=".8"/><text x="100" y="126" fill="#7dd3fc" font-size="3.8" text-anchor="middle">TOKENS · VECTOR · [00] PERCEPTION</text></g>
    <g fill="#334155"><rect x="42" y="134" width="1.4" height="6"/><rect x="45" y="134" width=".8" height="6"/><rect x="47.4" y="134" width="1.8" height="6"/><rect x="51" y="134" width=".8" height="6"/><rect x="53.4" y="134" width="1.4" height="6"/></g><text x="60" y="139" fill="#64748b" font-size="3" font-family="Consolas,monospace" font-weight="900">0 TOKENS</text><text x="42" y="145" fill="#475569" font-size="3" font-family="Consolas,monospace" font-weight="900">OWNER PROFILE</text>`],
  ["nav-settings.svg", "settings", "Configuración", "#cbd5e1", "#64748b", "CONFIG", `
    <defs>
      <linearGradient id="{{id}}-gearm" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e2e8f0"/><stop offset=".35" stop-color="#94a3b8"/><stop offset=".7" stop-color="#475569"/><stop offset="1" stop-color="#1e293b"/></linearGradient>
      <radialGradient id="{{id}}-gearc"><stop stop-color="#334155"/><stop offset=".7" stop-color="#1f2937"/><stop offset="1" stop-color="#0b1420"/></radialGradient>
    </defs>
    <ellipse cx="62" cy="112" rx="26" ry="4" fill="#000" opacity=".3"/>
    <g filter="url(#{{id}}-shadow)" transform="translate(62 80)">
      <g class="{{id}}-spin">
        <g fill="url(#{{id}}-gearm)" stroke="#0f172a" stroke-width="1">
          <g><rect x="-4" y="-33" width="8" height="12" rx="2"/><path d="M-1.6-31v8" stroke="#f8fafc" stroke-width=".7" opacity=".55"/></g>
          <g transform="rotate(30)"><rect x="-4" y="-33" width="8" height="12" rx="2"/><path d="M-1.6-31v8" stroke="#f8fafc" stroke-width=".7" opacity=".55"/></g>
          <g transform="rotate(60)"><rect x="-4" y="-33" width="8" height="12" rx="2"/><path d="M-1.6-31v8" stroke="#f8fafc" stroke-width=".7" opacity=".55"/></g>
          <g transform="rotate(90)"><rect x="-4" y="-33" width="8" height="12" rx="2"/><path d="M-1.6-31v8" stroke="#f8fafc" stroke-width=".7" opacity=".55"/></g>
          <g transform="rotate(120)"><rect x="-4" y="-33" width="8" height="12" rx="2"/><path d="M-1.6-31v8" stroke="#f8fafc" stroke-width=".7" opacity=".55"/></g>
          <g transform="rotate(150)"><rect x="-4" y="-33" width="8" height="12" rx="2"/><path d="M-1.6-31v8" stroke="#f8fafc" stroke-width=".7" opacity=".55"/></g>
          <g transform="rotate(180)"><rect x="-4" y="-33" width="8" height="12" rx="2"/><path d="M-1.6-31v8" stroke="#f8fafc" stroke-width=".7" opacity=".55"/></g>
          <g transform="rotate(210)"><rect x="-4" y="-33" width="8" height="12" rx="2"/><path d="M-1.6-31v8" stroke="#f8fafc" stroke-width=".7" opacity=".55"/></g>
          <g transform="rotate(240)"><rect x="-4" y="-33" width="8" height="12" rx="2"/><path d="M-1.6-31v8" stroke="#f8fafc" stroke-width=".7" opacity=".55"/></g>
          <g transform="rotate(270)"><rect x="-4" y="-33" width="8" height="12" rx="2"/><path d="M-1.6-31v8" stroke="#f8fafc" stroke-width=".7" opacity=".55"/></g>
          <g transform="rotate(300)"><rect x="-4" y="-33" width="8" height="12" rx="2"/><path d="M-1.6-31v8" stroke="#f8fafc" stroke-width=".7" opacity=".55"/></g>
          <g transform="rotate(330)"><rect x="-4" y="-33" width="8" height="12" rx="2"/><path d="M-1.6-31v8" stroke="#f8fafc" stroke-width=".7" opacity=".55"/></g>
        </g>
        <circle r="24" fill="url(#{{id}}-gearc)" stroke="#cbd5e1" stroke-width="1.6"/>
        <circle r="20.5" fill="none" stroke="#475569" stroke-width="1"/>
        <circle r="17" fill="none" stroke="#64748b" stroke-width=".8" stroke-dasharray="1.5 3"/>
        <path d="M-14-14a20 20 0 0 1 28 0" fill="none" stroke="#f8fafc" stroke-width="1.4" opacity=".5"/>
        <path d="M14 14a20 20 0 0 1-28 0" fill="none" stroke="#0b1420" stroke-width="1.8" opacity=".8"/>
        <g fill="#0b1420" stroke="#475569" stroke-width=".8"><rect x="-2" y="-19" width="4" height="11" rx="1.5" transform="rotate(45)"/><rect x="-2" y="-19" width="4" height="11" rx="1.5" transform="rotate(135)"/><rect x="-2" y="-19" width="4" height="11" rx="1.5" transform="rotate(225)"/><rect x="-2" y="-19" width="4" height="11" rx="1.5" transform="rotate(315)"/></g>
        <g fill="#0b1420" stroke="#64748b" stroke-width=".9"><circle cx="13" cy="0" r="3"/><circle cx="0" cy="13" r="3"/><circle cx="-13" cy="0" r="3"/><circle cx="0" cy="-13" r="3"/></g>
        <g fill="#94a3b8"><circle cx="0" cy="-24" r="1.1"/><circle cx="17" cy="-17" r="1.1"/><circle cx="24" cy="0" r="1.1"/><circle cx="17" cy="17" r="1.1"/><circle cx="0" cy="24" r="1.1"/><circle cx="-17" cy="17" r="1.1"/><circle cx="-24" cy="0" r="1.1"/><circle cx="-17" cy="-17" r="1.1"/></g>
      </g>
      <circle r="9.5" fill="#1f2937" stroke="#e2e8f0" stroke-width="2"/>
      <circle r="4.2" fill="#0b1420" stroke="#94a3b8" stroke-width="1.4"/>
      <path d="M-2.4 0h4.8M0-2.4v4.8" stroke="#94a3b8" stroke-width=".9"/>
      <rect x="-1.2" y="-6.4" width="2.4" height="2.6" fill="#94a3b8"/>
    </g>
    <circle cx="62" cy="80" r="15" fill="none" stroke="{{A}}" stroke-width="1.4" stroke-dasharray="4 4" class="{{id}}-dash"/>
    <circle class="{{id}}-blink" cx="62" cy="80" r="2.6" fill="#e2e8f0" filter="url(#{{id}}-glow)"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.2"><text x="96" y="62" fill="#94a3b8">PROVIDER</text><text x="96" y="80" fill="#94a3b8">PRIVACY</text><text x="96" y="98" fill="#94a3b8">HARDWARE</text></g>
    <g><path d="M124 59h34" stroke="#334155" stroke-width="2.4"/><circle cx="141" cy="59" r="3.4" fill="#38bdf8"/>
      <path d="M124 77h34" stroke="#334155" stroke-width="2.4"/><circle cx="152" cy="77" r="3.4" fill="#4ade80"/>
      <path d="M124 95h34" stroke="#334155" stroke-width="2.4"/><circle cx="128" cy="95" r="3.4" fill="#ef4444"/></g>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3"><g fill="#0b1320" stroke="#475569"><rect x="96" y="104" width="10" height="7" rx="1.5"/><rect x="109" y="104" width="10" height="7" rx="1.5"/><rect x="122" y="104" width="10" height="7" rx="1.5"/><rect x="135" y="104" width="10" height="7" rx="1.5"/><rect x="148" y="104" width="10" height="7" rx="1.5"/></g><circle cx="101" cy="107.5" r="1.4" fill="#38bdf8"/><text x="158" y="117" fill="#64748b" text-anchor="end">6 PROV</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><rect x="40" y="121" width="52" height="14" rx="2.4" fill="#111318" stroke="{{A}}" stroke-width=".9"/><path d="M48 127v-2a2.4 2.4 0 0 1 4.8 0v2" fill="none" stroke="#e2e8f0" stroke-width=".9"/><rect x="46.6" y="127" width="7.6" height="5.5" rx="1.2" fill="#1f2937" stroke="#e2e8f0" stroke-width=".7"/><text x="58" y="130.5" fill="#e2e8f0" font-size="3.8">KEYS HIDDEN</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><rect x="100" y="122" width="60" height="12" rx="2" fill="#111318" stroke="{{B}}" stroke-width=".9"/><text x="130" y="130" fill="#94a3b8" font-size="3.8" text-anchor="middle">GOVERNANCE</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="146" fill="#475569" font-size="3">CSP ON</text><text x="100" y="146" fill="#94a3b8" font-size="3.8" text-anchor="middle">SAFE OFF · LOCAL FIRST</text></g>`],
  ["nav-skills.svg", "skills", "Taller de habilidades", "#fb923c", "#a78bfa", "WORKSHOP", `
    <g filter="url(#{{id}}-shadow)"><rect x="40" y="56" width="62" height="60" rx="3" fill="#0d0a14" stroke="{{A}}" stroke-width="1.3"/></g>
    <path d="M40 64h62" stroke="#3b2b16"/><circle cx="45" cy="60" r="1.2" fill="{{A}}"/><circle cx="50" cy="60" r="1.2" fill="{{B}}"/>
    <g stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round"><path d="M47 73h30M47 81h36M47 89h26M47 97h33"/></g>
    <g fill="{{B}}"><circle cx="44" cy="73" r="1.3"/><circle cx="44" cy="81" r="1.3"/><circle cx="44" cy="89" r="1.3"/><circle cx="44" cy="97" r="1.3"/></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="47" y="106" fill="#64748b" font-size="3">4 PASOS · RISK LOW</text></g>
    <circle cx="92" cy="106" r="8" fill="#07111e" stroke="#4ade80"/><path d="m88.5 106 2.6 2.6 5.4-6" fill="none" stroke="#4ade80" stroke-width="1.8"/>
    <g filter="url(#{{id}}-shadow)"><rect x="108" y="56" width="52" height="20" rx="3" fill="#100d1c" stroke="{{B}}"/></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="134" y="64" fill="{{B}}" font-size="4" text-anchor="middle">SIM PLAN</text><text x="134" y="71" fill="#4ade80" font-size="3.6" text-anchor="middle">0 EFFECTS · EXEC OFF</text></g>
    <g fill="none" stroke="#475569"><path d="M110 88h44"/></g>
    <g><circle cx="112" cy="88" r="3" fill="{{A}}"/><circle cx="126" cy="88" r="3" fill="{{B}}"/><circle cx="140" cy="88" r="3" fill="#4ade80"/><circle cx="154" cy="88" r="3" fill="#475569"/></g>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.2"><text x="112" y="95" fill="{{A}}" text-anchor="middle">DRAFT</text><text x="140" y="95" fill="#a7f3d0" text-anchor="middle">APPROVED</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><rect x="108" y="100" width="52" height="16" rx="2" fill="#07111e" stroke="{{A}}" stroke-width=".8"/><text x="134" y="107" fill="#fdba74" font-size="3.4" text-anchor="middle">REVISAR-PROVEEDORES</text><text x="134" y="113" fill="#64748b" font-size="3.2" text-anchor="middle">SHA 8A4F…91C2 · v1</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="141" fill="#475569" font-size="3">R4</text><text x="100" y="141" fill="#fca5a5" font-size="3.8" text-anchor="middle">LIFECYCLE · EXECUTION BLOCKED</text></g>`],
  ["nav-procedures.svg", "procedures", "Procedimientos", "#34d399", "#fbbf24", "LEARNING", `
    <g filter="url(#{{id}}-shadow)" font-family="Consolas,monospace" font-weight="900" font-size="4">
      <rect x="40" y="66" width="34" height="24" rx="3" fill="#052e2b" stroke="{{A}}"/><text x="57" y="80" fill="{{A}}" text-anchor="middle">R3 × 3</text>
      <rect x="83" y="66" width="36" height="24" rx="3" fill="#071713" stroke="{{A}}"/><text x="101" y="80" fill="#a7f3d0" text-anchor="middle">CANDIDATE</text>
      <rect x="128" y="66" width="32" height="24" rx="3" fill="#422006" stroke="{{B}}"/><text x="144" y="80" fill="{{B}}" text-anchor="middle">R4 DRAFT</text>
    </g>
    <path class="{{id}}-dash" d="M74 78h9m36 0h9" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="3 2"/><path d="m79 75 4 3-4 3m32-6 4 3-4 3" fill="none" stroke="#e2e8f0" stroke-width="1.1"/>
    <g class="{{id}}-blink" fill="#4ade80"><circle cx="46" cy="72" r="1.5"/><circle cx="51" cy="72" r="1.5"/><circle cx="56" cy="72" r="1.5"/></g>
    <g stroke="#4ade80" stroke-width=".8" fill="none"><path d="m46 84 2 2 4-4m8 0 2 2 4-4m8 0 2 2 4-4"/></g>
    <g fill="#475569"><circle cx="91" cy="84" r=".8"/><circle cx="95" cy="84" r=".8"/><circle cx="99" cy="84" r=".8"/><circle cx="103" cy="84" r=".8"/><circle cx="107" cy="84" r=".8"/></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="57" y="94" fill="#64748b" font-size="3" text-anchor="middle">3 OCC · 2 PASOS</text></g>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.4">
      <rect x="42" y="98" width="36" height="10" rx="2" fill="#052e2b" stroke="#4ade80" stroke-width=".8"/><text x="60" y="105" fill="#a7f3d0" text-anchor="middle">RETAIN</text>
      <rect x="82" y="98" width="36" height="10" rx="2" fill="#1c1013" stroke="#ef4444" stroke-width=".8"/><text x="100" y="105" fill="#fca5a5" text-anchor="middle">DISMISS</text>
      <rect x="122" y="98" width="38" height="10" rx="2" fill="#0b1320" stroke="{{B}}" stroke-width=".8"/><text x="141" y="105" fill="#fde68a" text-anchor="middle">VALID</text>
    </g>
    <circle cx="100" cy="120" r="9" fill="none" stroke="{{B}}" stroke-dasharray="4 3" class="{{id}}-dash"/>
    <g font-family="Consolas,monospace" font-weight="900"><text x="100" y="122" fill="{{B}}" font-size="3.6" text-anchor="middle">REVIEW</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="141" fill="#475569" font-size="3">R5</text><text x="100" y="141" fill="#fca5a5" font-size="3.8" text-anchor="middle">DETECT · RETAIN · NEVER EXECUTE</text></g>`],
  ["bridge-overview.svg", "overview", "Registro de capacidades", "#2dd4bf", "#fb923c", "REGISTRY", `
    <g filter="url(#{{id}}-shadow)"><circle cx="100" cy="92" r="34" fill="#071c22" stroke="{{A}}" stroke-width="1.3"/></g>
    <path d="M100 126a34 34 0 1 1 34-34" fill="none" stroke="#1e293b" stroke-width="5.4"/>
    <path d="M100 58a34 34 0 0 1 31 48" fill="none" stroke="{{A}}" stroke-width="5.4" stroke-linecap="round" filter="url(#{{id}}-glow)"/>
    <circle cx="100" cy="92" r="21" fill="none" stroke="#1f5e62" stroke-dasharray="3 4" class="{{id}}-dash"/>
    <g stroke="#475569" stroke-width=".7"><path d="M138 92h-4M100 130v-4M62 92h4M127 119l-3-3M73 119l3-3"/></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="100" y="96" fill="#fff" font-size="11" text-anchor="middle">15</text><text x="100" y="105" fill="#64748b" font-size="4" text-anchor="middle">/ 25 LIVE</text></g>
    <circle class="{{id}}-blink" cx="131" cy="105" r="3" fill="{{B}}"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.6">
      <rect x="42" y="116" width="54" height="11" rx="2" fill="#052e2b" stroke="{{A}}" stroke-width=".8"/><text x="69" y="123.5" fill="{{A}}" text-anchor="middle">LIVE · 15</text>
      <rect x="104" y="116" width="54" height="11" rx="2" fill="#2a170a" stroke="{{B}}" stroke-width=".8"/><text x="131" y="123.5" fill="{{B}}" text-anchor="middle">PLANNED · 10</text>
    </g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="100" y="140" fill="#64748b" font-size="3.6" text-anchor="middle">SNAPSHOT v1 · NATIVE · PROBES</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="146" fill="#475569" font-size="3">R1</text><text x="100" y="146" fill="#475569" font-size="3" text-anchor="middle">perception.* · memory.* · cloud.*</text></g>`],
  ["bridge-face.svg", "face", "Calibración facial", "#f472b6", "#22d3ee", "FACE CALIBRATION", `
    <g font-family="Consolas,monospace" font-weight="900"><text x="160" y="58" fill="#ef4444" font-size="4.4" text-anchor="end">NO SIGNAL</text></g>
    <g filter="url(#{{id}}-shadow)"><rect x="86" y="60" width="28" height="17" rx="3" fill="url(#{{id}}-metal)" stroke="#94a3b8"/><circle cx="100" cy="68.5" r="5.6" fill="#020617" stroke="{{A}}"/><circle cx="100" cy="68.5" r="3.4" fill="#0f172a" stroke="{{B}}" stroke-width=".7"/></g>
    <path d="m93 62 14 12" stroke="#ef4444" stroke-width="1.8"/>
    <g filter="url(#{{id}}-shadow)"><path d="M86 90c8-6 20-3 25 7 2 5 1 9 4 13l5 5-5 4c0 7-3 12-9 13l-1 7h-24l4-10c-6-7-9-15-7-23 1-6 4-12 8-16Z" fill="#111c2a" stroke="url(#{{id}}-ga)" stroke-width="1.3"/></g>
    <g fill="#475569" stroke="#94a3b8" stroke-width=".6"><circle cx="96" cy="97" r="1.5"/><circle cx="105" cy="101" r="1.5"/><circle cx="110" cy="109" r="1.5"/><circle cx="107" cy="118" r="1.5"/><circle cx="99" cy="123" r="1.5"/><circle cx="90" cy="117" r="1.5"/></g>
    <path d="M96 97l9 4 5 8-3 9-8 5-9-6" fill="none" stroke="#334155" stroke-width=".7"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="2.8" fill="#475569"><text x="114" y="100">LM 478</text><text x="114" y="126">BS 52</text></g>
    <rect class="{{id}}-scan" x="84" y="104" width="34" height="1.2" fill="{{B}}" opacity=".7"/>
    <path d="M70 88h-6v-6M130 88h6v-6M70 124h-6v6M130 124h6v6" fill="none" stroke="#475569" stroke-width=".8"/>
    <g font-family="Consolas,monospace" font-weight="900">
      <g transform="translate(40 66)"><rect width="18" height="58" rx="2" fill="#150b16" stroke="#ef4444"/><text x="9" y="8" fill="#fda4af" font-size="3.4" text-anchor="middle">DEPS</text><g fill="#3f0b13" stroke="#ef4444"><circle cx="9" cy="16" r="2.2"/><circle cx="9" cy="25" r="2.2"/><circle cx="9" cy="34" r="2.2"/><circle cx="9" cy="43" r="2.2"/></g><text x="9" y="54" fill="#ef4444" font-size="3.8" text-anchor="middle">0/5</text></g>
      <g transform="translate(142 66)"><rect width="18" height="58" rx="2" fill="#07131d" stroke="{{B}}"/><text x="9" y="8" fill="#67e8f9" font-size="3.4" text-anchor="middle">CHAN</text><g fill="#0f172a" stroke="#38bdf8"><circle cx="6" cy="16" r="1.7"/><circle cx="12" cy="16" r="1.7"/><circle cx="6" cy="25" r="1.7"/><circle cx="12" cy="25" r="1.7"/><circle cx="6" cy="34" r="1.7"/><circle cx="12" cy="34" r="1.7"/><circle cx="6" cy="43" r="1.7"/><circle cx="12" cy="43" r="1.7"/></g><text x="9" y="54" fill="#67e8f9" font-size="3.8" text-anchor="middle">0/8</text></g>
    </g>
    <g font-family="Consolas,monospace" font-weight="900"><rect x="64" y="130" width="72" height="9" rx="2" fill="#0b1320" stroke="{{B}}" stroke-width=".8"/><text x="100" y="136.5" fill="#67e8f9" font-size="3.4" text-anchor="middle">R2 · CRITICAL · 60s</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="146" fill="#475569" font-size="3">MEDIAPIPE</text><text x="100" y="146" fill="#64748b" font-size="3.4" text-anchor="middle">CAMERA OFF · VIDEO NOT STORED</text></g>`],
  ["bridge-body.svg", "body", "Puente corporal", "#facc15", "#4ade80", "SOLVER", `
    <g filter="url(#{{id}}-shadow)" fill="none" stroke="{{A}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M62 78v24M62 84l-13 7M62 84l13 7M62 102l-8 17M62 102l8 17"/></g>
    <path d="M57 99a7 7 0 0 1 5-4" stroke="{{B}}" stroke-width=".9" fill="none"/>
    <g fill="#fff7b2" stroke="{{A}}" stroke-width="1.3"><circle cx="62" cy="72" r="5.4"/><circle cx="62" cy="84" r="2.4"/><circle cx="62" cy="102" r="2.4"/></g>
    <g class="{{id}}-blink" fill="{{B}}"><circle cx="49" cy="91" r="1.8"/><circle cx="75" cy="91" r="1.8"/><circle cx="54" cy="119" r="1.8"/><circle cx="70" cy="119" r="1.8"/></g>
    <ellipse cx="62" cy="124" rx="20" ry="3.6" fill="none" stroke="{{B}}" stroke-width=".8" stroke-dasharray="4 3" class="{{id}}-dash"/>
    <circle cx="126" cy="92" r="26" fill="none" stroke="#475569" stroke-width=".9" stroke-dasharray="3 4"/>
    <g fill="#0b1320" stroke="#475569"><circle cx="126" cy="66" r="3"/><circle cx="148" cy="79" r="3"/><circle cx="152" cy="103" r="3"/><circle cx="136" cy="116" r="3"/><circle cx="116" cy="116" r="3"/><circle cx="100" cy="103" r="3"/><circle cx="104" cy="79" r="3"/></g>
    <circle cx="126" cy="66" r="3" fill="{{B}}" class="{{id}}-blink"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.4"><text x="126" y="94" fill="#fde68a" text-anchor="middle">FSM 7</text><text x="126" y="102" fill="#64748b" font-size="3" text-anchor="middle">IDLE.FBX</text></g>
    <g transform="translate(96 124)" fill="#172536" stroke="#93c5fd" stroke-width=".8"><path d="M0 0c1.4-3.6 5-4.6 8.4-2.3l2.3 2.3h8.6l2.3-2.3c3.4-2.3 7-1.3 8.4 2.3l-2.8 3.7-4.6-1.4h-14l-4.6 1.4z"/></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="140" fill="#475569" font-size="3">RETARGET</text><text x="100" y="140" fill="#64748b" font-size="3.5" text-anchor="middle">12 CLIPS · IK 0.0-1.9 · MANUAL R3</text></g>`],
  ["nucleus-volume.svg", "volume", "Volumen neuronal", "#22d3ee", "#fbbf24", "SEED", `
    <circle cx="100" cy="94" r="16" fill="url(#{{id}}-halo)" stroke="#cffafe" stroke-width="1.5" filter="url(#{{id}}-glow)"/>
    <path d="M100 78v-4M86 82l-3-3M114 82l3-3" stroke="{{B}}" stroke-width=".9" opacity=".7"/>
    <circle cx="100" cy="94" r="27" fill="none" stroke="{{A}}" stroke-width="1" stroke-dasharray="5 4" class="{{id}}-dash" opacity=".7"/>
    <circle cx="100" cy="94" r="38" fill="none" stroke="#475569" stroke-width=".8" stroke-dasharray="2 5" opacity=".6"/>
    <g stroke="#477081" stroke-width=".8"><path d="M100 94 72 80M100 94l28-14M100 94 76 110M100 94l24 16M100 94V66M100 94v28" opacity=".7"/></g>
    <g fill="#fff"><circle cx="72" cy="80" r="2.4"/><circle cx="128" cy="80" r="2.4"/><circle cx="76" cy="110" r="2.4"/><circle cx="124" cy="110" r="2.4"/><circle cx="100" cy="66" r="2.4"/><circle cx="100" cy="122" r="2.4"/></g>
    <g fill="{{A}}"><circle cx="72" cy="80" r="1.1"/><circle cx="76" cy="110" r="1.1"/><circle cx="100" cy="66" r="1.1"/></g><g fill="{{B}}"><circle cx="128" cy="80" r="1.1"/><circle cx="124" cy="110" r="1.1"/><circle cx="100" cy="122" r="1.1"/></g>
    <circle class="{{id}}-blink" cx="138" cy="94" r="2.2" fill="{{B}}"/>
    <g font-family="Consolas,monospace" font-weight="900"><text x="100" y="92" fill="#031018" font-size="3.8" text-anchor="middle">SEED</text><text x="100" y="100" fill="#031018" font-size="3" text-anchor="middle">DENS 34%</text></g>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.4"><text x="58" y="60" fill="#2dd4bf">ENTRADA</text><text x="100" y="56" fill="#38bdf8" text-anchor="middle">CONTEXTO</text><text x="142" y="60" fill="#fbbf24" text-anchor="end">SALIDA</text></g>
    <g fill="#475569"><circle cx="64" cy="132" r="1.4"/><circle cx="72" cy="132" r="1.4"/><circle cx="80" cy="132" r="1.4"/><circle cx="88" cy="132" r="1.4"/><circle cx="96" cy="132" r="1.4"/><circle cx="104" cy="132" r="1.4"/><circle cx="112" cy="132" r="1.4"/><circle cx="120" cy="132" r="1.4"/><circle cx="128" cy="132" r="1.4"/><circle cx="136" cy="132" r="1.4"/></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="142" fill="#475569" font-size="3">R6</text><text x="100" y="142" fill="#64748b" font-size="3.5" text-anchor="middle">10 ANCHORS · AFFECT 0.00 ×10</text></g>`],
  ["nucleus-flow.svg", "flow", "Flujo cognitivo", "#8b5cf6", "#ec4899", "LINKS", `
    <g fill="none" stroke="url(#{{id}}-ga)" stroke-width="1.6" stroke-linecap="round" class="{{id}}-dash" stroke-dasharray="8 4"><path d="M52 96q10-20 28-18M88 76q12-8 24-2M120 76q10 8 14 18M138 98q8 6 10 4" filter="url(#{{id}}-glow)"/></g>
    <g filter="url(#{{id}}-shadow)" stroke="#fff" stroke-width="1.1"><circle cx="44" cy="96" r="7.4" fill="{{A}}"/><circle cx="82" cy="78" r="7.4" fill="#a78bfa"/><circle cx="112" cy="74" r="7.4" fill="{{B}}"/><circle cx="136" cy="96" r="7.4" fill="#f9a8d4"/><circle cx="152" cy="112" r="7.4" fill="#f472b6"/></g>
    <g font-family="Consolas,monospace" font-weight="900" font-size="4.2" fill="#fff"><text x="44" y="110" text-anchor="middle">IN</text><text x="82" y="92" text-anchor="middle">MEM</text><text x="112" y="88" text-anchor="middle">AFF</text><text x="136" y="110" text-anchor="middle">WS</text><text x="152" y="126" text-anchor="middle">OUT</text></g>
    <g class="{{id}}-blink" fill="#fff"><circle cx="66" cy="84" r="1.7"/><circle cx="100" cy="73" r="1.7"/><circle cx="124" cy="86" r="1.7"/></g>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.2" fill="#64748b"><text x="64" y="68">R3</text><text x="98" y="64">R3</text><text x="122" y="80">R3</text></g>
    <g font-family="Consolas,monospace" font-weight="900" font-size="2.8" fill="#475569"><text x="66" y="92">0%</text><text x="100" y="82">0%</text><text x="124" y="94">0%</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="137" fill="#475569" font-size="3">R3</text><rect x="52" y="130" width="96" height="10" rx="2" fill="#0b1320" stroke="{{A}}" stroke-width=".8"/><text x="100" y="137" fill="#e9d5ff" font-size="3.6" text-anchor="middle">EVIDENCED LINKS ONLY</text></g>`],
  ["nucleus-state.svg", "state", "Estado interno", "#10b981", "#f59e0b", "INTERNAL", `
    <g filter="url(#{{id}}-shadow)"><rect x="42" y="60" width="116" height="62" rx="3" fill="#071b18" stroke="{{A}}" stroke-width="1.3"/></g>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.6"><text x="48" y="74" fill="#94a3b8">R3 SIGNAL</text><text x="48" y="92" fill="#94a3b8">MEMORY</text><text x="48" y="110" fill="#94a3b8">AFFECT</text></g>
    <rect x="86" y="68" width="56" height="7" rx="3.5" fill="#0b2824" stroke="#1f3c38"/><rect x="86" y="68" width="40" height="7" rx="3.5" fill="{{A}}" filter="url(#{{id}}-glow)"/><circle class="{{id}}-blink" cx="126" cy="71.5" r="2.4" fill="#d1fae5"/>
    <rect x="86" y="86" width="56" height="7" rx="3.5" fill="#0b2824" stroke="#3d301e"/><rect x="86" y="86" width="24" height="7" rx="3.5" fill="{{B}}"/><circle class="{{id}}-blink2" cx="110" cy="89.5" r="2.4" fill="#fef3c7"/>
    <path d="M100 68v7M114 68v7M100 86v7M114 86v7" stroke="#06201c" stroke-width="1"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3" fill="#64748b"><text x="146" y="78" text-anchor="end">62%</text><text x="146" y="96" text-anchor="end">34%</text></g>
    <rect x="86" y="104" width="56" height="7" rx="3.5" fill="#0b2824" stroke="#1f3c38"/><rect x="86" y="104" width="2" height="7" rx="1" fill="#475569"/><text x="146" y="110" fill="#64748b" font-size="3.4" text-anchor="end">0.00</text>
    <g><circle cx="146" cy="70" r="6.4" fill="#1c1013" stroke="#ef4444"/><path d="m143.4 70 2.2 2.2 3.6-4" fill="none" stroke="#ef4444" stroke-width="1.4"/></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="100" y="132" fill="#64748b" font-size="3.5" text-anchor="middle">BEHAVIOR LOCKED · HEURISTIC</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="143" fill="#475569" font-size="3">TTL 30'</text><text x="100" y="143" fill="{{A}}" font-size="3.8" text-anchor="middle">SIGNALS R3 · MEMORY LOCAL</text></g>`],
  ["nucleus-planner.svg", "planner", "Planificador de acciones", "#f59e0b", "#38bdf8", "PLANNER", `
    <g filter="url(#{{id}}-shadow)"><circle cx="68" cy="92" r="26" fill="#171207" stroke="{{A}}" stroke-width="1.5"/><circle cx="68" cy="92" r="18.5" fill="none" stroke="#71531c" stroke-dasharray="3 4" class="{{id}}-dash"/></g>
    <path d="M68 70v3M68 114v-3M46 92h3M90 92h-3" stroke="#71531c" stroke-width="1"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3" fill="#64748b"><text x="68" y="66" text-anchor="middle">T-0</text></g>
    <g fill="{{B}}"><circle cx="68" cy="70" r="2.4"/><circle cx="90" cy="92" r="2.4"/><circle cx="68" cy="114" r="2.4"/><circle cx="46" cy="92" r="2.4"/></g>
    <path d="M68 92v-14M68 92l11 7" stroke="{{A}}" stroke-width="2.2" stroke-linecap="round" filter="url(#{{id}}-glow)"/><circle cx="68" cy="92" r="4" fill="#fff1b8" stroke="#a16207"/>
    <g font-family="Consolas,monospace" font-weight="900" font-size="3.6">
      <rect x="104" y="66" width="54" height="11" rx="2" fill="#0b1320" stroke="#475569"/><text x="109" y="74" fill="#94a3b8">INTENT</text><text x="153" y="74" fill="#ef4444" text-anchor="end">—</text>
      <rect x="104" y="81" width="54" height="11" rx="2" fill="#0b1320" stroke="#475569"/><text x="109" y="89" fill="#94a3b8">UTILITY</text><text x="153" y="89" fill="#ef4444" text-anchor="end">—</text>
      <rect x="104" y="96" width="54" height="11" rx="2" fill="#0b1320" stroke="#475569"/><text x="109" y="104" fill="#94a3b8">RISK</text><text x="153" y="104" fill="#ef4444" text-anchor="end">—</text>
    </g>
    <rect x="104" y="112" width="54" height="10" rx="2" fill="none" stroke="#475569" stroke-dasharray="3 3"/>
    <g font-family="Consolas,monospace" font-weight="900"><text x="131" y="119" fill="#475569" font-size="3.4" text-anchor="middle">+ SLOT</text></g>
    <g font-family="Consolas,monospace" font-weight="900"><text x="42" y="141" fill="#475569" font-size="3">R7</text><text x="100" y="141" fill="#fca5a5" font-size="3.8" text-anchor="middle">NO CANDIDATE · NO DECISION</text></g>`],
];

const controls = [
  ["view-pan.svg", "pan", "Desplazar vista", "#38bdf8", "#22d3ee", "PAN", `
    <g stroke="{{A}}" stroke-width="6" stroke-linecap="round" fill="none" filter="url(#{{id}}-glow)"><path d="M100 62v72M64 98h72"/></g>
    <g fill="{{A}}"><path d="M100 50l-12 16h24zM100 146l12-16H88zM52 98l16-12v24zM148 98l-16 12v-24z"/></g>
    <circle cx="100" cy="98" r="10" fill="#e0f2fe"/><circle class="{{id}}-blink" cx="100" cy="98" r="4" fill="{{B}}"/>
    <g font-family="Consolas,monospace" font-weight="900"><text x="100" y="154" fill="#64748b" font-size="3.5" text-anchor="middle">X 0.00 · Y 0.00</text></g>`],
  ["view-reset.svg", "reset", "Restablecer vista", "#a78bfa", "#f472b6", "HOME", `
    <path class="{{id}}-dash" d="M134 76a42 42 0 1 0 8 40" fill="none" stroke="{{A}}" stroke-width="6" stroke-linecap="round" stroke-dasharray="18 8" filter="url(#{{id}}-glow)"/>
    <path d="m132 58 6 28-28-6z" fill="{{A}}"/>
    <path d="M86 100l14-12 14 12v14H86z" fill="{{B}}"/><rect x="96" y="104" width="8" height="10" fill="#0b1420"/>
    <circle class="{{id}}-blink" cx="100" cy="70" r="3" fill="#e0f2fe"/>
    <g font-family="Consolas,monospace" font-weight="900"><text x="100" y="154" fill="#64748b" font-size="3.5" text-anchor="middle">POS 0 · ROT 0</text></g>`],
  ["view-rotate.svg", "rotate", "Rotar vista", "#22d3ee", "#fb923c", "ORBIT", `
    <g fill="none" stroke-linecap="round" filter="url(#{{id}}-glow)"><path class="{{id}}-dash" d="M64 84a40 40 0 0 1 68-12" stroke="{{A}}" stroke-width="6" stroke-dasharray="16 7"/><path d="M136 112a40 40 0 0 1-68 12" stroke="{{B}}" stroke-width="6"/></g>
    <path d="m136 60-4 24-22-12z" fill="{{A}}"/><path d="m64 136 4-24 22 12z" fill="{{B}}"/>
    <circle cx="100" cy="98" r="9" fill="#0b1420" stroke="#e0f2fe" stroke-width="3"/>
    <g font-family="Consolas,monospace" font-weight="900"><text x="100" y="154" fill="#64748b" font-size="3.5" text-anchor="middle">X 0° · Y 0°</text></g>`],
  ["view-zoom-in.svg", "zoomin", "Acercar vista", "#34d399", "#22d3ee", "ZOOM +", `
    <circle cx="90" cy="90" r="34" fill="#06131f" stroke="{{A}}" stroke-width="6" filter="url(#{{id}}-glow)"/>
    <circle class="{{id}}-dash" cx="90" cy="90" r="24" fill="none" stroke="{{B}}" stroke-width="3" stroke-dasharray="6 6"/>
    <path d="M90 76v28M76 90h28" stroke="#e0f2fe" stroke-width="6" stroke-linecap="round"/>
    <path d="M114 114l30 30" stroke="{{A}}" stroke-width="7" stroke-linecap="round"/>
    <g font-family="Consolas,monospace" font-weight="900"><text x="132" y="70" fill="#64748b" font-size="3.5" text-anchor="middle">100%</text></g>`],
  ["view-zoom-out.svg", "zoomout", "Alejar vista", "#fb923c", "#ef4444", "ZOOM -", `
    <circle cx="90" cy="90" r="34" fill="#160b06" stroke="{{A}}" stroke-width="6" filter="url(#{{id}}-glow)"/>
    <circle class="{{id}}-dash" cx="90" cy="90" r="24" fill="none" stroke="{{B}}" stroke-width="3" stroke-dasharray="6 6"/>
    <path d="M76 90h28" stroke="#e0f2fe" stroke-width="6" stroke-linecap="round"/>
    <path d="M114 114l30 30" stroke="{{A}}" stroke-width="7" stroke-linecap="round"/>
    <g font-family="Consolas,monospace" font-weight="900"><text x="132" y="70" fill="#64748b" font-size="3.5" text-anchor="middle">100%</text></g>`],
];

function renderKey([file, id, title, accent, secondary, label, rawScene]) {
  const scene = rawScene.replaceAll("{{A}}", accent).replaceAll("{{B}}", secondary).replaceAll("{{id}}", id);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${title}">
  <title>${title}</title>
  <style>
    .${id}-dash{animation:${id}Dash 2.8s linear infinite}.${id}-blink{animation:${id}Blink 1.6s steps(2,end) infinite}.${id}-blink2{animation:${id}Blink 2.3s steps(2,end) .5s infinite}.${id}-scan{animation:${id}Scan 4.2s ease-in-out infinite}.${id}-spin{transform-box:fill-box;transform-origin:50% 50%;animation:${id}Spin 16s linear infinite}
    @keyframes ${id}Dash{to{stroke-dashoffset:-26}}@keyframes ${id}Blink{50%{opacity:.25}}
    @keyframes ${id}Scan{0%,100%{y:50px;opacity:.06}50%{y:140px;opacity:.4}}
    @keyframes ${id}Spin{to{transform:rotate(360deg)}}
    @media(prefers-reduced-motion:reduce){.${id}-dash,.${id}-blink,.${id}-blink2,.${id}-scan,.${id}-spin{animation:none}}
  </style>
  <defs>
    <radialGradient id="${id}-plate" cx="38%" cy="30%" r="80%"><stop stop-color="#1b2836"/><stop offset=".55" stop-color="#0b1420"/><stop offset="1" stop-color="#04080d"/></radialGradient>
    <linearGradient id="${id}-ga" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${accent}"/><stop offset=".55" stop-color="#f8fafc"/><stop offset="1" stop-color="${secondary}"/></linearGradient>
    <linearGradient id="${id}-gb" x1="0" x2="1"><stop stop-color="${secondary}"/><stop offset="1" stop-color="${accent}"/></linearGradient>
    <linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#94a3b8"/><stop offset=".35" stop-color="#334155"/><stop offset=".7" stop-color="#111827"/><stop offset="1" stop-color="#020617"/></linearGradient>
    <radialGradient id="${id}-halo"><stop stop-color="#fff"/><stop offset=".2" stop-color="${accent}"/><stop offset=".7" stop-color="${secondary}"/><stop offset="1" stop-color="#07111d"/></radialGradient>
    <filter id="${id}-shadow" x="-45%" y="-45%" width="190%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="2.6" flood-color="#000" flood-opacity=".85"/></filter>
    <filter id="${id}-glow" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect x="20" y="20" width="160" height="160" rx="32" fill="#02050a"/>
  <rect x="25" y="25" width="150" height="150" rx="27" fill="url(#${id}-plate)" stroke="url(#${id}-ga)" stroke-width="2.4"/>
  <rect x="34" y="34" width="132" height="132" rx="21" fill="none" stroke="#1e293b" stroke-width="1.2"/>
  <path d="M42 54v-8q0-4 4-4h8M158 54v-8q0-4-4-4h-8M42 146v8q0 4 4 4h8M158 146v8q0 4-4 4h-8" fill="none" stroke="${accent}" stroke-width="1.6" opacity=".5"/>
  <g fill="#1e293b" stroke="#475569" stroke-width=".6"><circle cx="31" cy="31" r="1.6"/><circle cx="169" cy="31" r="1.6"/><circle cx="31" cy="169" r="1.6"/><circle cx="169" cy="169" r="1.6"/></g>
  <path d="M88 40h6M106 40h6" stroke="#1e293b" stroke-width="1.4"/>
  <g font-family="Consolas,monospace" font-weight="900"><text x="58" y="50" fill="#475569" font-size="3">ALICE // LOCAL-FIRST</text><text x="142" y="50" fill="#475569" font-size="3" text-anchor="end">v0.1.0</text></g>
  <path d="M36 62v76M164 62v76" stroke="#1e293b" stroke-width=".7"/>
  <path d="M36 68h2.5M36 80h1.8M36 92h2.5M36 104h1.8M36 116h2.5M36 128h1.8M164 68h-2.5M164 80h-1.8M164 92h-2.5M164 104h-1.8M164 116h-2.5M164 128h-1.8" stroke="#475569" stroke-width=".6"/>
  <circle class="${id}-blink" cx="100" cy="42" r="2.2" fill="${secondary}" filter="url(#${id}-glow)"/>
  ${scene.trim()}
  <rect class="${id}-scan" x="40" y="50" width="120" height="1.4" fill="${accent}"/>
  <g fill="#334155"><rect x="40" y="166" width="1.4" height="6"/><rect x="43" y="166" width=".8" height="6"/><rect x="45.2" y="166" width="1.8" height="6"/><rect x="48.6" y="166" width=".8" height="6"/><rect x="51" y="166" width="1.3" height="6"/><rect x="54" y="166" width=".8" height="6"/></g><rect x="46.6" y="166" width="1" height="6" fill="${accent}"/>
  <g font-family="Consolas,monospace" font-weight="900"><text x="160" y="171" fill="#475569" font-size="3.2" text-anchor="end">SN-${id.toUpperCase()}</text></g>
  <g font-family="Consolas,monospace" font-weight="900"><text x="100" y="163" fill="#64748b" font-size="7" text-anchor="middle" letter-spacing="2">${label}</text></g>
</svg>\n`;
}

const generated = [...screens, ...controls].filter(([file]) => !handAuthoredIcons.has(file));
for (const icon of generated) writeFileSync(join(root, icon[0]), renderKey(icon), "utf8");
console.log(`Generated ${generated.length} legacy keys; preserved ${handAuthoredIcons.size} hand-authored functional icons.`);
