// Owner inspection: persisted R3 metadata and passive checks, never repair or execution.
export function auditInspectionScene(a, b, { plinth, fastener, socket }) {
  const categories = [
    ['path', 'M-5-2h4l2 2h5v6H-5Z'],
    ['dataVersion', 'm0-5 6 3-6 3-6-3Zm-6 6 6 3 6-3m-12 4 6 3 6-3'],
    ['provider', 'M-5-4H5v8H-5Zm2 11h6M0 4v3'],
    ['adapter', 'M-3-5v4m6-4v4M-5-1H5v4L2 6h-4l-3-3ZM0 6v3'],
    ['permission', 'M-4-1h8v7h-8Zm1 0v-3a3 3 0 0 1 6 0v3'],
  ];
  const cells = categories.map(([category, glyph], i) => {
    const y = 57 + i * 18;
    return `<g data-detail="diagnostic-category-cell" data-category="${category}" transform="translate(148 ${y})">
      <path d="M-15-8H12l5 5V9l-5 4h-27l-4-4V-3Z" fill="url(#dark-metal)" stroke="${b}" stroke-width=".64"/>
      <path d="M-12-5H9l4 3v9H-12Z" fill="#030914" stroke="#475569" stroke-width=".35"/>
      <path d="${glyph}" transform="translate(-4 1) scale(.8)" fill="none" stroke="${i % 2 ? a : b}" stroke-width=".8" stroke-linejoin="round"/>
      <circle cx="9" cy="1" r="1.35" fill="#64748b" stroke="#cbd5e1" stroke-width=".3"/>
      <path d="M-10 10h14M-17-3v8" stroke="#94a3b8" stroke-width=".35"/>
      <g data-detail="diagnostic-module-retainers" stroke="#a9bbcd" stroke-width=".28"><path d="M-10-6h7m12 4h3m-3 7h3M-12 8h5"/></g>
    </g>`;
  }).join('');
  const events = Array.from({ length: 5 }, (_, i) => {
    const y = 70 + i * 11;
    return `<g data-detail="correlated-audit-event"><path d="M48 ${y}h42" stroke="#334155" stroke-width=".55"/>
      <path d="M52 ${y - 2}h8m4 0h${i % 2 ? 13 : 19}m-27 5h26" stroke="#94a3b8" stroke-width=".48"/>
      <path d="m44 ${y - 2} 2 2-2 2-2-2Z" fill="${i % 2 ? b : a}"/>
      <circle cx="92" cy="${y}" r="1.25" fill="none" stroke="${b}" stroke-width=".4"/>
    </g>`;
  }).join('');
  return `${plinth(a,b,152)}
  <g data-detail="owner-inspection-console" filter="url(#shadow)">
    <path d="M28 146V56l17-18h109l18 18v90" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width="1.2"/>
    <path d="M36 139V60l13-13h101l14 13v79" fill="#030914" stroke="#475569" stroke-width=".62"/>
    <path d="M50 43h95M39 135h120" stroke="#94a3b8" stroke-width=".36"/>
    ${fastener(36,53,a,1)}${fastener(164,53,b,1)}
  </g>
  <g data-detail="r3-correlated-ledger">
    <path d="M40 61h51l12 12v57H40Z" fill="#0f172a" stroke="#64748b" stroke-width=".65"/>
    <path d="M37 57h51l12 12v57H37Z" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width=".75"/>
    <path d="M37 57h51v12h12" fill="none" stroke="${a}" stroke-width=".65"/>
    <path d="M43 65v54" stroke="${a}" stroke-width=".48"/>${events}
    <g data-detail="metadata-correlation-contacts">${[49,55,61,67,73,79,85,91].map((x,i)=>`<path d="M${x} 120v3" stroke="${i%3 ? '#64748b' : b}" stroke-width=".65"/>`).join('')}</g>
  </g>
  <g data-detail="schema-inspection-optic">
    <path d="M107 110v30h13" fill="none" stroke="#020409" stroke-width="4"/>
    <path d="M107 111v28h13" fill="none" stroke="url(#metal)" stroke-width="1.5"/>
    <circle cx="102" cy="89" r="25" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width=".85"/>
    <circle cx="102" cy="89" r="21.8" fill="#020812" stroke="${b}" stroke-width=".72"/>
    <circle cx="102" cy="89" r="18.5" fill="url(#glass)" stroke="#64748b" stroke-width=".38"/>
    <path d="M89 80v-4h7m12 0h7v4m0 18v4h-7m-12 0h-7v-4" fill="none" stroke="${a}" stroke-width=".7"/>
    <g data-detail="inspected-event-fields" fill="none" stroke="#cbd5e1" stroke-width=".55"><path d="M94 83h4v4h-4Zm0 8h4v4h-4Zm7-7h10m-10 3h7m-7 5h10m-10 3h7"/></g>
    <path class="pulse" d="M88 89h28" stroke="${b}" stroke-width=".65"/>
    <path d="M85 86a18 18 0 0 1 12-14" fill="none" stroke="#f8fafc" stroke-width=".45" opacity=".65"/>
    ${fastener(102,66,b,.7)}${fastener(102,112,a,.7)}
  </g>
  <g data-detail="passive-diagnostic-bank">${cells}</g>
  <g data-detail="read-only-diagnostic-probe"><path d="M165 94h10" stroke="#64748b" stroke-width=".65"/>${socket(180,94,b,a,4.5)}</g>
  <g data-detail="audit-rotation-cartridge"><path d="M39 136h44l5 5-5 10H39l-5-8Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".65"/><path d="M43 140h35v7H43Zm4 2v3m4-3v3m4-3v3" fill="none" stroke="${a}" stroke-width=".4"/>${fastener(81,144,b,.65)}</g>
  <g data-detail="invalid-line-trap"><path d="M90 128h25v22H90Z" fill="#0b101b" stroke="#64748b" stroke-width=".58"/><path d="M93 132h19m-18 4 6 7m0-7-6 7m10-6h6" stroke="${a}" stroke-width=".65"/></g>
  <g data-detail="no-effect-isolator"><path d="M125 149h37" stroke="#64748b" stroke-width="1.5"/><path d="M138 146h10v6h-10Z" fill="#020617" stroke="#94a3b8" stroke-width=".48"/><path d="M141 146v-3a2 2 0 0 1 4 0v3" fill="none" stroke="${b}" stroke-width=".48"/></g>`;
}
