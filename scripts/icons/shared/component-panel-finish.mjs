// Refine real component housings, using their own outlines and local coordinates.
// Inserts are placed immediately behind the existing contents, clipped to the plate:
// no free-floating decoration, no changes to icons' semantics, glyphs or layout.
import { componentHardwareDetails } from './component-hardware-details.mjs';
const panels = {
  activity:['temporal-event-window','selected-event-inspector','local-event-filter-deck','temporal-retention-buffer'],
  audit:['diagnostic-category-cell','r3-correlated-ledger','audit-rotation-cartridge','invalid-line-trap'],
  avatar:['vrm-read-only-inspector','recessed-inspector-panel','manual-gamepad-dock','connection-boundary-rail'],
  body:['solver-telemetry','inactive-retarget-output','tapered-rig-strut','segmented-thoracic-plates'],
  capabilities:['capability-domain-cartridge','selected-capability-inspector','versioned-adapter-descriptor'],
  face:['vrm-read-only-inspector','camera-off-shutter','expression-reserve-bank','r2-permission-interlock'],
  flow:['perception-input-node','memory-context-node','language-process-node','governed-response-port','r3-evidence-monitor'],
  gateway:['prepared-request-capsule','explicit-owner-decision','ephemeral-grant-cartridge','revocation-breaker','separate-execution-port'],
  identification:['active-input-inspection-cassette','perception-provenance-vector','isolated-document-preview','diagnostic-mode-deck'],
  memory:['memory-layer','volatile-working-memory','archive-cartridge','retention-gate','backup-rail'],
  planner:['governed-arbitration-chamber','sealed-candidate-generator','uncalculated-metric-bank','owner-temporal-dock'],
  procedures:['correlated-occurrence','procedure-candidate-capsule','owner-decision-gate','owner-authorized-draft-conversion'],
  settings:['etched-hardware-module','manual-runtime-switch-bank','fiber-distribution-manifold','mandatory-send-review','external-hardware-safe-off'],
  skills:['versioned-skill-cartridge','manifest-revision-cartridge','static-simulation-chamber','owner-confirmation-key'],
  state:['selected-state-inspector','retrieved-memory-cartridge','locked-control-pair'],
  volume:['volume-provenance-inspector','volume-navigation-deck','inactive-affect-reserve'],
};

export function finishComponentPanels(markup,id) {
  const selected = new Set(panels[id] ?? []);
  let index = 0;
  const result = markup.replace(/(<g\b[^>]*data-detail="([^"]+)"[^>]*>\s*)(<path\b[^>]*\/>)/g, (whole,group,detail,path) => {
    if(!selected.has(detail)) return whole;
    const d = path.match(/\bd="([^"]+)"/)?.[1];
    const fill = path.match(/\bfill="([^"]+)"/)?.[1];
    if(!d || !fill || fill==='none') return whole;
    const clip=`panel-${id}-${index++}`;
    // All additions follow the actual perimeter, not a bounding rectangle.
    // The existing contents paint last; thin struts get a smaller inset.
    const slim = detail === 'tapered-rig-strut' || detail === 'segmented-thoracic-plates';
    const inset = slim ? .45 : 1.1;
    return `${group}${path}<g data-detail="precision-panel-bevel" data-panel="${detail}" pointer-events="none">
      <defs>
        <clipPath id="${clip}" clipPathUnits="userSpaceOnUse"><path d="${d}"/></clipPath>
        <linearGradient id="${clip}-finish" x1="0" y1="0" x2=".35" y2="1">
          <stop stop-color="#dcebf5" stop-opacity=".16"/>
          <stop offset=".22" stop-color="#90abc4" stop-opacity=".045"/>
          <stop offset=".6" stop-color="#020610" stop-opacity=".08"/>
          <stop offset="1" stop-color="#010409" stop-opacity=".28"/>
        </linearGradient>
      </defs>
      <g clip-path="url(#${clip})" fill="none">
        <path data-detail="panel-satin-face" d="${d}" fill="url(#${clip}-finish)"/>
        <path data-detail="panel-recess-gasket" d="${d}" stroke="#010610" stroke-width="${slim ? 1.2 : 2.7}" opacity=".8"/>
        <path data-detail="panel-machined-lip" d="${d}" transform="translate(${inset} ${inset})" stroke="#a8c0d3" stroke-width="${slim ? .3 : .5}" opacity=".82"/>
        <path d="${d}" transform="translate(-${inset} -${inset})" stroke="#040812" stroke-width="${slim ? .45 : .85}" opacity=".9"/>
        <path d="${d}" stroke="#c5d9e8" stroke-width=".5" opacity=".75"/>
        ${slim ? '' : `<path data-detail="panel-edge-joints" d="${d}" transform="translate(.45 .45)" stroke="#e2eef6" stroke-width=".35" stroke-dasharray="2 19" opacity=".55"/>`}
        ${componentHardwareDetails(id, detail, d)}
      </g>
    </g>`;
  });
  if(selected.size && !index) throw new Error(`No component panels matched ${id}`);
  return result;
}

export function precisionControlRim(id,a,b) {
  const zoom=id==='zoom-in'||id==='zoom-out';
  const cx=zoom?82:100, cy=zoom?82:id==='reset'?101:100, r=zoom?50.5:60.5;
  return `<g data-detail="precision-control-rim" pointer-events="none" fill="none">
    <g data-detail="control-recessed-bearing">
      <circle cx="${cx}" cy="${cy}" r="${r-2.3}" stroke="#020610" stroke-width="1.1"/>
      <circle cx="${cx}" cy="${cy}" r="${r-2.8}" stroke="#7e9cb5" stroke-width=".35" opacity=".8"/>
      <circle cx="${cx}" cy="${cy}" r="${r-1}" stroke="#d1e0eb" stroke-width=".75" stroke-dasharray="5 ${2*Math.PI*(r-1)/4-5}" transform="rotate(27 ${cx} ${cy})"/>
    </g>
    <g data-detail="control-bearing-retainers">
      ${[65,155,245,335].map(angle=>`<g transform="rotate(${angle} ${cx} ${cy})"><path d="M${cx-2} ${cy-r-.6}h4v3.2h-4Z" fill="url(#screw-metal)" stroke="#c1d3e0" stroke-width=".3"/><path d="M${cx-1} ${cy-r+.3}h2v1.4h-2Z" fill="#07121e" stroke="#637d94" stroke-width=".3"/><path d="M${cx-.6} ${cy-r+1}h1.2" stroke="#bacad7" stroke-width=".3"/></g>`).join('')}
    </g>
    <circle cx="${cx}" cy="${cy}" r="${r}" stroke="#bacddd" stroke-width=".35" opacity=".75"/>
    ${Array.from({length:24},(_,i)=>`<path d="M${cx} ${cy-r+.8}v${i%3?.9:1.4}" transform="rotate(${i*15+7.5} ${cx} ${cy})" stroke="#0a1524" stroke-width=".4"/>`).join('')}
    <path d="M${cx-r*.7} ${cy-r*.68}A${r-1} ${r-1} 0 0 1 ${cx-r*.3} ${cy-r*.94}" stroke="#edf7ff" stroke-width=".5" opacity=".6"/>
    ${zoom?`<g data-detail="optical-handle-grip"><path d="m124 124 28 28" stroke="#0a192b" stroke-width="1.2"/><path d="m125 124 28 28" stroke="${b}" stroke-width=".4"/>${[0,1,2,3].map(i=>`<path d="m${129+i*5} ${127+i*5} -2 2" stroke="#a8c2d7" stroke-width=".35"/>`).join('')}</g>`:''}
  </g>`.replace(/[\t ]+\n/g, '\n');
}
