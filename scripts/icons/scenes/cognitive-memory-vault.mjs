// Physical drawers are illustrative records, not an invented three-layer taxonomy.
// RAM, retrieval, owner decisions and backup remain distinct from persistent storage.
export function memoryRepositoryScene(a, b, { fastener }) {
  const drawers = [61,86,111].map((y,i)=>`<g data-detail="memory-layer" data-purpose="versioned-record-storage">
    <path d="M54 ${y}h59l10 8v14H54l-9-8v-7Z" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width=".75"/>
    <path data-detail="layer-machined-cap" d="M54 ${y}h59l10 8H54l-9-8m9 8v14" fill="none" stroke="#64748b" stroke-width=".45"/>
    <path data-detail="layer-data-window" d="M59 ${y+10}h49v8H59Z" fill="#020812" stroke="${i===1?b:a}" stroke-width=".5"/>
    <g data-detail="archive-drawer-latches" fill="none" stroke="#9dacc0" stroke-width=".3"><path d="M55 ${y+10}v8m57-8v8m-1-6h3m-3 4h3M63 ${y+20}h37"/></g>
    <g data-detail="record-provenance-fields"><path d="M63 ${y+12}h14m-14 3h9m10-3h19m-19 3h14" stroke="#94a3b8" stroke-width=".38"/></g>
    <g data-detail="layer-address-index">${[61,69,77,85,93,101,109].map((x,j)=>`<path d="M${x} ${y+3}h3" stroke="${j===i?a:'#64748b'}" stroke-width=".4"/>`).join('')}</g>
    <g data-detail="drawer-read-head" data-motion-purpose="decorative-only"><path class="memory-drawer-reflection" style="animation-delay:-${i*1.1}s" d="M61 ${y+6}h7" stroke="${i===1?b:a}" stroke-width=".85" filter="url(#soft-glow)"/></g>
    <g data-detail="drawer-release-clips" fill="url(#metal)" stroke="#a8bcd0" stroke-width=".3"><path d="M55 ${y+12}h2v5h-2Zm56 0h2v5h-2Z"/><path d="M63 ${y+20}h14m11 0h14" stroke="#7e95ae" stroke-width=".35"/></g>
    ${fastener(51,y+12,a,.7)}${fastener(117,y+15,b,.7)}
  </g>`).join('');
  return `<style>
    [data-icon="memory"] .alive{animation:none}
    .memory-drawer-reflection{animation:memory-drawer-reflection 3.8s ease-in-out infinite}
    .memory-query-ring{transform-origin:29px 101px;animation:memory-query-ring 10s linear infinite}
    .memory-base-reflection{animation:memory-base-reflection 4.6s ease-in-out infinite}
    @keyframes memory-drawer-reflection{0%,100%{transform:translateX(0);opacity:.3}50%{transform:translateX(42px);opacity:1}}
    @keyframes memory-query-ring{to{transform:rotate(360deg)}}
    @keyframes memory-base-reflection{0%,100%{transform:translateX(0);opacity:.3}50%{transform:translateX(84px);opacity:1}}
    @media(prefers-reduced-motion:reduce){.memory-drawer-reflection,.memory-query-ring,.memory-base-reflection{animation:none}}
  </style>
  <g data-detail="precision-equipment-plinth" data-base="memory-service-chassis">
    <ellipse cx="100" cy="175" rx="88" ry="6" fill="#000" opacity=".42"/>
    <path d="M20 158h160l10 8-10 10H20l-10-10Z" fill="url(#dark-metal)" stroke="#94abc2" stroke-width=".9"/>
    <path d="M24 161h152l6 5-6 7H24l-6-7Z" fill="#071221" stroke="#4f657f" stroke-width=".45"/>
    <path d="M27 159.5h146M27 174h146" stroke="#c7d7e4" stroke-width=".4"/>
    <g data-detail="base-service-panels">${[40,119].map((x,i)=>`<g><path d="M${x} 163h41v9h-41Z" fill="url(#dark-metal)" stroke="#8da5bf" stroke-width=".45"/><path d="M${x+4} 165h21v5h-21Z" fill="#040b16" stroke="#627e9a" stroke-width=".3"/><path d="M${x+7} 166v3m4-3v3m4-3v3m4-3v3" stroke="#b2c4d6" stroke-width=".35"/><path d="M${x+30} 165h6v5h-6Z" fill="#091625" stroke="${i?b:a}" stroke-width=".35"/><path d="M${x+32} 167.5h2" stroke="#a0b9d0" stroke-width=".4"/></g>`).join('')}</g>
    <g data-detail="base-central-coupler"><path d="m100 162 7 4v5l-7 4-7-4v-5Z" fill="url(#metal)" stroke="#b7cadd" stroke-width=".45"/><path d="M97 165h6v6h-6Z" fill="#081222" stroke="#9bb3c9" stroke-width=".35"/><path d="M98.5 167h3m-3 2h3" stroke="${b}" stroke-width=".35"/></g>
    <g data-detail="base-load-isolators"><path d="M36 176h18v2H36Zm110 0h18v2h-18Z" fill="#060b12" stroke="#425a73" stroke-width=".3"/></g>
    <g data-detail="base-bezel-illumination" data-motion-purpose="decorative-only"><path class="memory-base-reflection" d="M43 161h12" stroke="${a}" stroke-width=".75" filter="url(#soft-glow)"/></g>
    ${fastener(27,166,a,1)}${fastener(173,166,b,1)}
  </g>
  <g data-detail="memory-module-support-frame">
    <path d="M65 40v9m39-9v9" stroke="url(#metal)" stroke-width="2"/>
    <path d="M135 155V55l9-9h22l11 10v91l-8 11h-34Z" fill="url(#dark-metal)" stroke="#64748b" stroke-width=".65"/>
    <path d="M141 151V58l6-6h16l8 8v84l-6 8Z" fill="#030914" stroke="#334155" stroke-width=".4"/>
    <path d="M139 158h34m-31-108h19" stroke="#94a3b8" stroke-width=".4"/>
    ${fastener(170,53,b,.6)}${fastener(172,150,a,.6)}
  </g>
  <g data-detail="layered-memory-vault" filter="url(#shadow)">
    <path d="M40 145V62l14-17h65l15 17v83" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width="1.05"/>
    <path d="M48 137V65l10-11h58l10 11v72" fill="#030914" stroke="#475569" stroke-width=".6"/>
    <path d="M42 70v52m89-52v52M57 49h59M49 140h74" stroke="#94a3b8" stroke-width=".45"/>
    ${fastener(47,58,a,1)}${fastener(126,58,b,1)}${fastener(47,139,b,.85)}${fastener(126,139,a,.85)}
    ${drawers}
  </g>
  <g data-detail="volatile-working-memory" data-storage="ram-only">
    <path d="M59 29h53l7 6v8H59l-6-6Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".6"/>
    <path d="M64 33h36v6H64Z" fill="#020812" stroke="#64748b" stroke-width=".4"/>
    ${[68,74,80,86,92].map(x=>`<path d="M${x} 34v4" stroke="#94a3b8" stroke-width=".45"/>`).join('')}
    <path d="M106 32v7m-2-5h4m-4 3h4" stroke="${b}" stroke-width=".45"/>
    <g data-detail="ram-edge-contacts" stroke="#879db6" stroke-width=".3"><path d="M64 41h4m3 0h4m3 0h4m3 0h4m3 0h4M61 32v7"/></g>
  </g>
  <g data-detail="rag-index"><path d="M36 75h8m-8 0v14m0 25v12h8" fill="none" stroke="#64748b" stroke-width=".55"/>
    <g data-detail="retrieval-lens"><circle cx="29" cy="101" r="15" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width=".65"/><circle cx="29" cy="101" r="11.7" fill="url(#glass)" stroke="${a}" stroke-width=".55"/>
      <g data-detail="retrieval-focus-reticle" fill="none" stroke="#94a3b8" stroke-width=".4"><path d="M22 98v-3h4m6 0h4v3m0 6v3h-4m-6 0h-4v-3"/></g>
      <path d="M26 98h6v6h-6Z" fill="#020812" stroke="${b}" stroke-width=".45"/><path d="m37 113 7 9" stroke="url(#metal)" stroke-width="1.6"/>
      <path class="pulse" d="M24 110h10" stroke="${a}" stroke-width=".45"/>
      <g class="memory-query-ring" data-detail="retrieval-optic-index" data-motion-purpose="decorative-only" fill="none" stroke-width=".5"><path d="M16 101a13 13 0 0 1 13-13m13 13a13 13 0 0 1-13 13" stroke="#c3d9e7"/><path d="M29 87v2m14 12h-2m-12 14v-2m-14-12h2" stroke="${b}"/></g>
      <path d="M28 99h2m-2 2h2m-2 2h2" stroke="#a8bdd2" stroke-width=".3"/>
    </g>
  </g>
  <g data-detail="governed-record-core"><path d="M72 133h28l5 5-5 5H72l-5-5Z" fill="#020812" stroke="${b}" stroke-width=".55"/><path d="M77 135h7v6h-7Zm12 1h9m-9 3h6" fill="none" stroke="#94a3b8" stroke-width=".4"/></g>
  <g data-detail="memory-lifecycle-bus"><path d="M134 64h4v62" fill="none" stroke="#475569" stroke-width=".6"/></g>
  <g data-detail="retention-gates" data-authority="owner-decision">
    ${['validity','accessibility','suppression','archive','reconsolidation','deletion-delay'].map((dimension,i)=>{
      const y=53+i*10;
      const glyphs=['M0-3a3 3 0 1 0 0 6 3 3 0 1 0 0-6m0 1v2l2 1','M-2 0h4v3h-4Zm1 0v-2a1 1 0 0 1 2 0v2','M-4 0Q0-4 4 0 0 4-4 0Zm1 3 6-6','M-3-2h6v5h-6Zm-1-1h8v2h-8Zm3 4h2','m0-3 4 2-4 2-4-2Zm-4 4 4 2 4-2','M-2-3h4v2L0 0l2 1v2h-4V1l2-1-2-1Z'];
      return `<g data-detail="retention-gate" data-dimension="${dimension}"><path d="M144 ${y}h24l5 4v5h-29l-5-5Z" fill="url(#dark-metal)" stroke="#829ab4" stroke-width=".5"/><path data-detail="retention-policy-glyph" d="${glyphs[i]}" transform="translate(149 ${y+4.5}) scale(.75)" fill="none" stroke="#adc0d3" stroke-width=".4"/><path d="M155 ${y+3}h5m-5 3h4" stroke="#94a3b8" stroke-width=".35"/><circle cx="165" cy="${y+4.5}" r="1.8" fill="#020812" stroke="${i===5?'#fbbf24':i%2?b:a}" stroke-width=".4"/><path d="M138 ${y+5}h4" stroke="#64748b" stroke-width=".35"/></g>`;
    }).join('')}
  </g>
  <g data-detail="archive-channel"><g data-detail="archive-cartridges" data-policy="reversible-archive">
    ${[118,130].map((y,i)=>`<g data-detail="archive-cartridge"><path d="M144 ${y}h23l6 5-6 6h-23Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".5"/><path data-detail="archive-media-window" d="M148 ${y+3}h13v5h-13Z" fill="#020812" stroke="#64748b" stroke-width=".35"/><g data-detail="cartridge-contact-bank"><path d="M151 ${y+4}v3m4-3v3m4-3v3" stroke="${i?b:a}" stroke-width=".4"/></g></g>`).join('')}
  </g><path data-detail="archive-egress" d="M136 126h7" stroke="#64748b" stroke-width=".5"/></g>
  <g data-detail="backup-rail" data-purpose="backup-and-restore"><path d="M51 145h82l6 6-6 6H51l-6-6Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".65"/>
    <g data-detail="backup-mirror-channel"><path d="M61 148h28v6H61Zm37 0h28v6H98Z" fill="#020812" stroke="#92a9c0" stroke-width=".4"/><path d="M65 149.5h5v3h-5Zm38 0h5v3h-5Zm-30 .5h12m-12 2h9m26-2h13m-13 2h9" fill="none" stroke="#a7bdd2" stroke-width=".35"/></g>
    <g data-detail="backup-module-latches"><path d="M58 148v6m71-6v6M65 146h20m18 0h20M64 156h61" stroke="#859cb6" stroke-width=".3"/></g>
    <g data-detail="backup-checkpoints"><circle cx="94" cy="151" r="2" fill="#020812" stroke="${a}" stroke-width=".5"/>${fastener(53,151,a,.7)}${fastener(132,151,b,.7)}</g>
  </g>
  <g data-detail="owner-confirmed-record-association"><path d="M146 148h10v7h-10Zm12 0h10v7h-10Z" fill="#020812" stroke="#64748b" stroke-width=".4"/><path d="M153 151.5h9" stroke="${b}" stroke-width=".5"/></g>`;
}
