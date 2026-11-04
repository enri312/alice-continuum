// Mechanical detail only. Coordinates are local to the named component, not
// to the whole icon. No lights, statuses, arrows or new functional connections.
const latch = (x, y, height = 7) => `<g data-detail="captive-panel-latch" transform="translate(${x} ${y})">
  <path d="M0 0h2.8v${height}H0Z" fill="#020711" stroke="#607c96" stroke-width=".3"/>
  <path d="M.5 .5h1.8v${height-1}H.5Z" fill="url(#screw-metal)" stroke="#c4d3df" stroke-width=".25"/>
  <path d="M1.4 1.5v${height-3}" stroke="#091421" stroke-width=".6"/>
  <path d="M.7 2h1.4m-1.4 ${height-4}h1.4" stroke="#e1eaf0" stroke-width=".3"/>
</g>`;

const contacts = (x, y, width = 15) => `<g data-detail="recessed-service-connector" transform="translate(${x} ${y})">
  <path d="M0 0h${width}v2.8H0Z" fill="#030a13" stroke="#819bb2" stroke-width=".35"/>
  ${Array.from({length:5},(_,i)=>`<path d="M${2+i*(width-4)/4} .7v1.4" stroke="#b8c7d2" stroke-width=".55"/>`).join('')}
  <path d="M1 2.4h${width-2}" stroke="#344f68" stroke-width=".3"/>
</g>`;

const seam = d => `<path data-detail="panel-separation-seam" d="${d}" fill="none" stroke="#91a8bd" stroke-width=".4"/>`;

// Use only verified empty bands of these particular housings. Some decorative
// SVG groups start with a rear sheet; those are intentionally not targeted.
const hardware = {
  activity: {
    'selected-event-inspector': () => latch(133.3,104,12)+latch(167,108,12)+contacts(140,83,13),
    'temporal-event-window': () => contacts(42,129,22)+seam('M36 87v12m0 10v12'),
  },
  audit: {
    'diagnostic-category-cell': () => latch(13,0,7)+contacts(-8,10.2,12),
    'invalid-line-trap': () => contacts(95,146,14),
  },
  avatar: {
    'vrm-read-only-inspector': () => contacts(157,134.5,10)+seam('M154.5 69v10m0 35v10'),
    'manual-gamepad-dock': () => seam('M72 144v3m42-3v3M84 149l3 1m13 0 3-1'),
  },
  body: {
    'solver-telemetry': () => contacts(144,62,12)+latch(139.5,77,9)+latch(158,91,9),
    'inactive-retarget-output': () => latch(140,126,9)+latch(157,126,9),
  },
  capabilities: {
    'selected-capability-inspector': () => latch(155.8,109,10)+contacts(127,130,19),
    'capability-domain-cartridge': ([x,y]) => contacts(x+19,y+.8,20)+latch(x+61,y+3,5),
  },
  face: {
    'expression-reserve-bank': () => contacts(154,55.5,10)+latch(168.4,82,8)+latch(168.4,111,8),
    'camera-off-shutter': () => contacts(29,95,12),
  },
  flow: {
    'r3-evidence-monitor': () => contacts(138,63,18),
    'memory-context-node': () => contacts(34,118,17),
    'governed-response-port': () => latch(142.5,90,9)+contacts(150,106,13),
  },
  gateway: {
    'ephemeral-grant-cartridge': () => latch(142.8,91,9)+latch(167.5,109,9)+contacts(147,131,15),
    'prepared-request-capsule': () => latch(29.7,88,10)+seam('M58 94v9'),
  },
  identification: {
    'text-message-input': () => contacts(67,51,26),
    'conversational-voice-output': () => contacts(113,140,12),
  },
  memory: {
    'memory-layer': ([,y]) => contacts(79,y+1.8,20)+latch(120,y+10,9),
    'archive-cartridge': ([,y]) => latch(164,y+3,6),
  },
  planner: {
    'owner-temporal-dock': () => latch(142,95,10)+latch(168,110,10)+contacts(146,135,13),
    'uncalculated-metric-bank': () => contacts(34,74,16)+seam('M57 84v11m0 20v11'),
  },
  procedures: {
    'correlated-occurrence': ([,y]) => latch(89,y+5,7)+contacts(48,y+1,21),
    'owner-authorized-draft-conversion': () => latch(110,124,9)+seam('M156 123v10'),
  },
  settings: {
    'etched-hardware-module': ([,y]) => contacts(150,y+1.2,17)+latch(178,y+14,9),
    'manual-runtime-switch-bank': () => contacts(82,48.5,17),
  },
  skills: {
    'versioned-skill-cartridge': ([,y]) => latch(52.5,y+6,7),
    'static-simulation-chamber': () => contacts(135,58,14)+latch(160.5,77,8),
  },
  state: {
    'locked-control-pair': () => latch(-2,5,7)+latch(18,5,7),
    'retrieved-memory-cartridge': () => latch(64,123,7)+latch(137,123,7),
  },
  volume: {
    'volume-provenance-inspector': () => contacts(155,67,11)+latch(174,99,9)+latch(174,118,9),
    'volume-navigation-deck': () => latch(48,152,5)+latch(129,152,5),
  },
};

export function componentHardwareDetails(id, detail, outline) {
  const render = hardware[id]?.[detail];
  if (!render) return '';
  const origin = outline.match(/^[Mm]\s*(-?[\d.]+)(?:[ ,]+|(?=-))(-?[\d.]+)/);
  if (!origin) throw new Error(`Missing local origin for ${id}/${detail}`);
  return `<g data-detail="fitted-component-hardware" data-component="${detail}" pointer-events="none">${render([Number(origin[1]),Number(origin[2])])}</g>`;
}
