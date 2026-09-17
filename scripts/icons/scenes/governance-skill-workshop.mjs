// Habilidades.tsx: editable manifests, static simulation and owner-governed revisions.
export function skillWorkbenchScene(a, b, { plinth, fastener, socket }) {
  return `${plinth(a,b,158)}
  <g data-detail="governed-workbench-chassis" filter="url(#shadow)">
    <path d="M25 145V57l19-19h112l19 19v88l-11 12H36Z" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width="1.15"/>
    <path d="M34 138V62l14-15h104l14 15v76Z" fill="#030914" stroke="#475569" stroke-width=".65"/>
    <path d="M49 42h102M30 69v18m140-18v18M39 139h121" stroke="#94a3b8" stroke-width=".4"/>
    ${fastener(33,55,a,1)}${fastener(167,55,b,1)}${fastener(33,148,b,.8)}${fastener(167,148,a,.8)}
  </g>
  <g data-detail="local-skill-library"><path d="M36 64h20v63H36Z" fill="#07101b" stroke="#475569" stroke-width=".5"/>
    ${[67,86,105].map((y,i)=>`<g data-detail="versioned-skill-cartridge"><path d="M34 ${y}h18l5 4v11H34Z" fill="url(#dark-metal)" stroke="${i===0?a:'#94a3b8'}" stroke-width=".5"/><path d="M38 ${y+4}h12v6H38Z" fill="#020812" stroke="#475569" stroke-width=".35"/><path d="M41 ${y+6}h6m-6 2h4M38 ${y+13}h2m2 0h2m2 0h2" stroke="#94a3b8" stroke-width=".35"/></g>`).join('')}
  </g>
  <g data-detail="manifest-revision-cartridge">
    <path d="M67 61h45l13 12v60H67Z" fill="#0b1422" stroke="#64748b" stroke-width=".5"/>
    <path d="M63 56h46l13 12v61H63l-5-5V62Z" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width=".8"/>
    <path d="M109 56v13h13M65 74h46" fill="none" stroke="${a}" stroke-width=".5"/>
    <g data-detail="manifest-binding-and-registration" fill="none" stroke="#99acc4" stroke-width=".3"><path d="M60 76v43m0-38h3m-3 10h3m-3 10h3M69 60h18m-18 3h13M67 126h38"/></g>
    <g data-detail="manifest-editable-fields">${['title','description','purpose'].map((field,i)=>`<g data-field="${field}"><path d="M66 ${80+i*10}h38v7H66Z" fill="#020812" stroke="#475569" stroke-width=".35"/><path d="M70 ${83+i*10}h${i===1?27:20}" stroke="#94a3b8" stroke-width=".4"/></g>`).join('')}</g>
    <g data-detail="manifest-contract-chip"><path d="M67 111h14v12H67Z" fill="#020812" stroke="${b}" stroke-width=".5"/><path d="M71 114h6v6h-6Z" fill="url(#glass)" stroke="#94a3b8" stroke-width=".4"/><path d="M65 114h2m-2 5h2m14-5h2m-2 5h2M71 109v2m6-2v2" stroke="#94a3b8" stroke-width=".35"/></g>
    <g data-detail="manifest-hash-strip">${[87,91,94,99,103,108,112].map((x,i)=>`<path d="M${x} 115v7" stroke="${i%2?a:'#94a3b8'}" stroke-width="${i%2?.45:.75}"/>`).join('')}</g>
    <g data-detail="manifest-editing-stylus" transform="translate(116 82) rotate(32)"><path d="M-2-18h4v34l-2 6-2-6Z" fill="url(#metal)" stroke="#cbd5e1" stroke-width=".45"/><path d="M-2-12h4m-4 25h4M0-9V9" stroke="${a}" stroke-width=".5"/><path d="m-1 17 1 4 1-4" fill="#020812" stroke="#94a3b8" stroke-width=".3"/></g>
    ${fastener(62,61,a,.7)}${fastener(118,125,b,.7)}
  </g>
  <g data-detail="static-simulation-chamber" data-mode="simulation-only">
    <path d="M131 56h25l9 9v30h-34l-5-5V62Z" fill="url(#dark-metal)" stroke="${b}" stroke-width=".65"/>
    <path d="M134 62h18l7 7v20h-25Z" fill="url(#glass)" stroke="#64748b" stroke-width=".4"/>
    <g data-detail="static-plan-topology" fill="#020812" stroke="${a}" stroke-width=".55"><path d="M140 70h6v5h-6Zm-3 12h5v5h-5Zm13 0h5v5h-5Z"/><path d="M143 75v4h-3v3m3-3h9v3" fill="none"/></g>
    <path class="pulse" d="M135 91h8" stroke="${b}" stroke-width=".5"/>
    <g data-detail="zero-effect-indicators">${[149,154,159].map(x=>`<circle cx="${x}" cy="92" r="1" fill="#334155" stroke="#64748b" stroke-width=".3"/>`).join('')}</g>
  </g>
  <g data-detail="immutable-lifecycle-column">
    ${['draft','inReview','approved','disabled','retired'].map((status,i)=>`<g data-status="${status}" transform="translate(131 ${102+i*7})"><path d="M0 0h30v5H0Z" fill="#020812" stroke="#475569" stroke-width=".35"/><path d="M4 1.5h3v2H4Z" fill="none" stroke="${i===2?a:'#94a3b8'}" stroke-width=".35"/><path d="M11 2.5h15" stroke="#64748b" stroke-width=".4"/></g>`).join('')}
  </g>
  <g data-detail="capability-contract-bus"><path d="M58 133v4h65" fill="none" stroke="#64748b" stroke-width=".55"/><path d="M67 135v4m7-4v4m7-4v4" stroke="${b}" stroke-width=".4"/></g>
  <g data-detail="owner-confirmation-key"><path d="M43 141h73l5 6-5 8H43l-5-8Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".6"/>
    <path d="M50 145h13v7H50Zm3-2h7m7 5h10" fill="none" stroke="#94a3b8" stroke-width=".4"/><circle cx="84" cy="148" r="3" fill="#020812" stroke="${a}" stroke-width=".55"/><path d="M87 148h12v3m-5-3v2" stroke="${a}" stroke-width=".6"/>
    <path d="M105 145h7v6h-7Z" fill="#020812" stroke="#64748b" stroke-width=".4"/>
  </g>
  <g data-detail="execution-isolator" data-state="execution-disabled"><path d="M127 141h34v14h-34Z" fill="#020812" stroke="#64748b" stroke-width=".55"/>
    <path d="M130 149h7m14 0h7M140 147h8v6h-8Zm1 0v-3a3 3 0 0 1 6 0v3" fill="none" stroke="#fbbf24" stroke-width=".55"/>
  </g>
  <g data-detail="workshop-revision-rail"><path d="M38 130h12v5m106 1h7" fill="none" stroke="#475569" stroke-width=".45"/></g>
  <g data-detail="registry-contract-input">${socket(20,94,a,b,4.5)}<path d="M27 94h6" stroke="#64748b" stroke-width=".5"/></g>`;
}
