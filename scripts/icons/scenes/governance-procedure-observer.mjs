// R5: observed sequences -> owner decision -> explicitly converted R4 draft.
// These are symbolic records, never a live activity or execution indicator.
export function procedureEvidenceScene(a, b, { plinth, fastener, socket }) {
  const evidenceTapes = [62,82,102].map((y,row)=>`<g data-detail="correlated-occurrence" data-occurrence="${row}">
    <path d="M37 ${y-7}h51l7 5v9H37l-5-5v-4Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".55"/>
    <path d="M40 ${y-3}h46v7H40Z" fill="#020812" stroke="#334155" stroke-width=".35"/>
    <path d="M44 ${y}h37" stroke="#475569" stroke-width=".45"/>
    <g data-detail="repeated-step-sequence" fill="#020812" stroke="${a}" stroke-width=".6"><circle cx="46" cy="${y}" r="2.7"/><path d="M60 ${y-2.7}h5.4v5.4H60Zm20-.8 3.5 3.5-3.5 3.5-3.5-3.5Z"/></g>
    <g data-detail="occurrence-evidence-contacts" stroke="#64748b" stroke-width=".35">${[43,49,55,61,67,73,79,85].map(x=>`<path d="M${x} ${y+5}v2"/>`).join('')}</g>
    <path d="M35 ${y-3}v4" stroke="${b}" stroke-width=".4"/>
  </g>`).join('');
  return `${plinth(a,b,156)}
  <g data-detail="procedure-observation-chassis" filter="url(#shadow)">
    <path d="M24 144V52l19-18h114l19 18v92l-11 13H35Z" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width="1.15"/>
    <path d="M33 139V58l14-15h105l15 15v81Z" fill="#030914" stroke="#475569" stroke-width=".65"/>
    <path d="M47 39h106M29 63v23m142-23v23M38 136h123" stroke="#94a3b8" stroke-width=".4"/>
    ${fastener(32,51,a,1)}${fastener(168,51,b,1)}${fastener(32,147,b,.85)}${fastener(168,147,a,.85)}
  </g>
  <g data-detail="repetition-evidence-tapes">${evidenceTapes}</g>
  <g data-detail="occurrence-comparison-links"><path d="M94 62h6v16m-6 4h6m-6 20h6V86" fill="none" stroke="#64748b" stroke-width=".5"/><path d="M88 51h15v62H88" fill="none" stroke="#334155" stroke-width=".4" stroke-dasharray="2 2"/></g>
  <g data-detail="pattern-correlator">
    <path d="m106 69 9 6v14l-9 6-9-6V75Z" fill="url(#dark-metal)" stroke="${a}" stroke-width=".75"/>
    <path d="m106 74 5 3v10l-5 3-5-3V77Z" fill="#020812" stroke="#94a3b8" stroke-width=".4"/>
    <path d="M103 80h6m-6 4h6" stroke="${b}" stroke-width=".6"/>
    <path class="pulse" d="M104 92h4" stroke="${a}" stroke-width=".5"/>
  </g>
  <g data-detail="procedure-candidate-capsule">
    <path d="M126 56h29l10 10v50h-39Z" fill="#0b1520" stroke="#64748b" stroke-width=".5"/>
    <path d="M121 52h29l10 10v50h-39l-5-5V57Z" fill="url(#dark-metal)" stroke="${b}" stroke-width=".75"/>
    <path d="M150 52v11h10" fill="none" stroke="#cbd5e1" stroke-width=".5"/>
    <g data-detail="procedure-card-registration" fill="none" stroke="#adbbcc" stroke-width=".3"><path d="M123 56h17m-17 3h11M118 64v33m37-30v25m-2-20h3m-3 8h3m-3 8h3"/></g>
    <g data-detail="ordered-procedure-steps"><path d="M126 66v29" stroke="#64748b" stroke-width=".45"/>
      ${[68,79,90].map((y,i)=>`<g data-step="${i}"><path d="M123 ${y-3}h6v6h-6Z" fill="#020812" stroke="${a}" stroke-width=".5"/><path d="M134 ${y-2}h16m-16 4h11" stroke="#94a3b8" stroke-width=".4"/></g>`).join('')}
    </g>
    <g data-detail="candidate-fingerprint"><path d="M122 98h31v10h-31Z" fill="#020812" stroke="#475569" stroke-width=".4"/>${[125,129,132,137,141,145,149].map((x,i)=>`<path d="M${x} 101v4" stroke="${i%2?'#94a3b8':b}" stroke-width="${i%2?.45:.8}"/>`).join('')}</g>
  </g>
  <g data-detail="owner-decision-gate">
    <path d="M41 119h56l7 6v11H41l-6-6v-5Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".6"/>
    <g data-decision="retain"><path d="M44 122h18v11H44Z" fill="#020812" stroke="${a}" stroke-width=".45"/><path d="M50 124h6v7l-3-2-3 2Z" fill="none" stroke="${a}" stroke-width=".5"/></g>
    <g data-detail="explicit-owner-confirmation"><path d="M68 127h7v7h-7Zm1 0v-2a2.5 2.5 0 0 1 5 0v2" fill="#020812" stroke="${b}" stroke-width=".55"/></g>
    <g data-decision="dismiss"><path d="M81 122h17v11H81Z" fill="#020812" stroke="#64748b" stroke-width=".45"/><path d="m86 125 6 5m0-5-6 5" stroke="#fb7185" stroke-width=".55"/></g>
  </g>
  <g data-detail="owner-authorized-draft-conversion" data-result="draft-only"><path d="M109 120h51v16h-51Z" fill="url(#dark-metal)" stroke="#64748b" stroke-width=".55"/>
    <path d="M114 124h9v8h-9Zm13 4h5m5-7h12l5 5v8h-17Zm12 0v5h5" fill="none" stroke="#94a3b8" stroke-width=".45"/>
    <path d="M141 128h8m-8 3h5" stroke="${b}" stroke-width=".4"/>
  </g>
  <g data-detail="procedure-evidence-lifecycle">${['current','stale','dismissed','converted','blocked'].map((state,i)=>`<g data-evidence-state="${state}" transform="translate(${46+i*18} 147)"><path d="M-6-5H6v10H-6Z" fill="#020812" stroke="#475569" stroke-width=".4"/><path d="${['M-2-2H2v4H-2Z','M-2 0h4','M-2-2 2 2m0-4-4 4','M-3-2h4v4h-4m2-6h4v4','M-2 0h4v3H-2Zm1 0v-2h2v2'][i]}" fill="none" stroke="${i===0?a:i===4?b:'#94a3b8'}" stroke-width=".5"/></g>`).join('')}</g>
  <g data-detail="execution-isolator" data-state="no-execution"><path d="M135 140h25v14h-25Z" fill="#020812" stroke="#64748b" stroke-width=".55"/><path d="M139 147h6m6 0h6m-10-4v8m2-8v8" stroke="#fb7185" stroke-width=".6"/></g>
  <g data-detail="passive-evidence-input">${socket(20,82,a,b,4.5)}<path d="M27 82h5" stroke="#64748b" stroke-width=".55"/></g>`;
}
