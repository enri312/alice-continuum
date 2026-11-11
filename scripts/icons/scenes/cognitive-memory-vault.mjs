// An open knowledge repository with sourced study routes, not a biological brain.
// The three folios illustrate versioned records; they do not invent memory layers.
// Retrieval, RAM, owner decisions, archive and backup remain separate components.
export function memoryRepositoryScene(a, b, { fastener }) {
  const folios = [141,137,133].map((y,i)=>`<g data-detail="memory-layer" data-purpose="versioned-record-storage">
    <path d="M43 ${y-52}Q67 ${y-58} 98 ${y-44}Q123 ${y-58} 148 ${y-52}V${y}Q123 ${y-6} 98 ${y+6}Q68 ${y-6} 43 ${y}Z" fill="url(#metal)" stroke="#bdcddb" stroke-width=".9"/>
    <path data-detail="layer-machined-cap" d="M43 ${y-52}Q67 ${y-58} 98 ${y-44}Q123 ${y-58} 148 ${y-52}M98 ${y-44}v50" fill="none" stroke="#dce9f0" stroke-width=".5"/>
    <path data-detail="layer-data-window" d="M49 ${y-46}Q73 ${y-49} 94 ${y-39}V${y-2}Q70 ${y-11} 49 ${y-7}Zm53 7Q125 ${y-49} 142 ${y-46}V${y-7}Q122 ${y-11} 102 ${y-2}Z" fill="#071422" stroke="${i===2?a:'#70879d'}" stroke-width=".6"/>
    <g data-detail="layer-address-index" fill="none" stroke="#a5bacb" stroke-width=".4"><path d="M48 ${y-1}l4-1m2 1 4-1m2 2 4-1m66 1 4 1m2-2 4 1"/></g>
    <g data-detail="drawer-read-head" data-motion-purpose="decorative-only"><path class="memory-drawer-reflection" style="animation-delay:-${i*1.1}s" d="M57 ${y-8}l7 .4" stroke="${i===2?a:b}" stroke-width=".75" filter="url(#soft-glow)"/></g>
  </g>`).join('');
  const sourceNodes = [[51,66,a],[69,45,b],[99,40,a],[128,46,b],[148,66,a]];
  const glyphs = ['M0-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5m0 .5v2l1.5 1','M-2 0h4v3h-4Zm1 0v-2a1 1 0 0 1 2 0v2','M-4 0Q0-4 4 0 0 4-4 0Zm1 3 6-6','M-3-2h6v5h-6Zm-1-1h8v2h-8Zm3 4h2','m0-3 4 2-4 2-4-2Zm-4 4 4 2 4-2','M-2-3h4v2L0 0l2 1v2h-4V1l2-1-2-1Z'];
  return `<style>
    [data-icon="memory"] .alive{animation:none}
    .memory-drawer-reflection{animation:memory-drawer-reflection 4s ease-in-out infinite}
    .memory-query-ring{transform-origin:26px 111px;animation:memory-query-ring 12s linear infinite}
    .memory-base-reflection{animation:memory-base-reflection 4.6s ease-in-out infinite}
    .memory-study-path{animation:memory-study-path 6s linear infinite}
    @keyframes memory-drawer-reflection{0%,100%{transform:translateX(0);opacity:.3}50%{transform:translateX(18px);opacity:1}}
    @keyframes memory-query-ring{to{transform:rotate(360deg)}}
    @keyframes memory-base-reflection{0%,100%{transform:translateX(0);opacity:.3}50%{transform:translateX(84px);opacity:1}}
    @keyframes memory-study-path{to{stroke-dashoffset:-24}}
    @media(prefers-reduced-motion:reduce){.memory-drawer-reflection,.memory-query-ring,.memory-base-reflection{animation:none}.memory-study-path{animation:none}}
  </style>
  <g data-detail="precision-equipment-plinth" data-base="memory-service-chassis">
    <ellipse cx="100" cy="176" rx="87" ry="5" fill="#000" opacity=".42"/>
    <path d="M21 160h158l11 8-11 10H21l-11-10Z" fill="url(#dark-metal)" stroke="#97b0c5" stroke-width=".9"/>
    <path d="M26 163h148l8 5-8 6H26l-8-6Z" fill="#071221" stroke="#526d85" stroke-width=".45"/>
    <path d="M29 161.5h142M29 176h142" stroke="#c7d7e4" stroke-width=".4"/>
    <g data-detail="base-service-panels">${[41,121].map((x,i)=>`<g><path d="M${x} 165h38v7h-38Z" fill="url(#dark-metal)" stroke="#8da5bf" stroke-width=".45"/><path d="M${x+4} 167h20v3h-20Z" fill="#040b16" stroke="#627e9a" stroke-width=".3"/><path d="M${x+7} 167v3m4-3v3m4-3v3m4-3v3" stroke="#b2c4d6" stroke-width=".35"/><path d="M${x+29} 167h5v3h-5Z" fill="#091625" stroke="${i?b:a}" stroke-width=".35"/></g>`).join('')}</g>
    <g data-detail="base-central-coupler"><path d="m100 163 6 4v5l-6 4-6-4v-5Z" fill="url(#metal)" stroke="#b7cadd" stroke-width=".45"/><circle cx="100" cy="169.5" r="2" fill="#081222" stroke="${b}" stroke-width=".5"/></g>
    <g data-detail="base-bezel-illumination" data-motion-purpose="decorative-only"><path class="memory-base-reflection" d="M43 163h12" stroke="${a}" stroke-width=".75" filter="url(#soft-glow)"/></g>
    ${fastener(27,168,a,1)}${fastener(173,168,b,1)}
  </g>
  <g data-detail="sourced-study-network" data-representation="illustrative-not-live">
    <path d="M51 66 69 45 99 40 128 46 148 66M69 45l29 28 30-27M51 66l47 7 50-7M99 40l-1 33v17" fill="none" stroke="#0a1625" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M51 66 69 45 99 40 128 46 148 66M69 45l29 28 30-27M51 66l47 7 50-7M99 40l-1 33v17" fill="none" stroke="#6a879e" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="memory-study-path" d="M51 66 69 45 99 40 128 46 148 66M99 40l-1 33v17" fill="none" stroke="${a}" stroke-width="1.15" stroke-dasharray="4 8" stroke-linecap="round" filter="url(#soft-glow)"/>
    ${sourceNodes.map(([x,y,color],i)=>`<g data-detail="sourced-knowledge-node" data-source-slot="${i}"><circle cx="${x}" cy="${y}" r="7.1" fill="url(#metal)" stroke="#c3d5e3" stroke-width=".65"/><circle cx="${x}" cy="${y}" r="5.2" fill="#06101d" stroke="${color}" stroke-width=".75"/><path d="M${x-2} ${y-2}h4v4h-4Z" fill="${color}" stroke="#e8f5ff" stroke-width=".4"/><path d="M${x-4.5} ${y-4}l1-1m7 1-1-1" stroke="#c2d8e8" stroke-width=".4"/></g>`).join('')}
    <g data-detail="source-provenance-hub"><path d="m98 65 7 4v8l-7 4-7-4v-8Z" fill="url(#dark-metal)" stroke="#d3e4ee" stroke-width=".75"/><circle cx="98" cy="73" r="3" fill="#0d2235" stroke="${b}" stroke-width=".8"/><path d="M98 70.5v5m-2.5-2.5h5" stroke="#c8baf4" stroke-width=".45"/></g>
  </g>
  <g data-detail="volatile-working-memory" data-storage="ram-only">
    <g data-detail="ram-package-housing"><path d="M82 19h31l5 4v8H82l-5-4v-4Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".6"/></g>
    <path d="M85 22h23v6H85Z" fill="#020812" stroke="#64748b" stroke-width=".4"/>
    <path d="M89 23v4m5-4v4m5-4v4m5-4v4m-19 5h4m3 0h4m3 0h4m3 0h4" stroke="#b0c5d6" stroke-width=".45"/>
    <circle cx="112" cy="25" r="1.5" fill="${b}"/>
  </g>
  <g data-detail="layered-memory-vault" data-form="open-knowledge-repository" filter="url(#shadow)">
    <path d="M38 85Q64 76 98 91Q130 76 153 85v58Q122 137 98 151Q68 137 38 143Z" fill="url(#dark-metal)" stroke="#b6cbd9" stroke-width="1.35"/>
    ${folios}
    <path d="M98 89v50" stroke="${b}" stroke-width="1.4"/>
    <path d="M95 92v43m6-43v43" stroke="#c8dbe8" stroke-width=".35" opacity=".7"/>
    <g data-detail="record-provenance-fields" fill="none" stroke-linecap="round">
      <path d="M57 98h10m5 1 12 3m-27 3 26 5m-26 3 19 4m-19 5 23 4" stroke="#a7d3e7" stroke-width="1"/>
      <path d="M112 103l24-5m-24 12 24-5m-24 12 18-4m-18 13 24-4" stroke="#c4b7ee" stroke-width="1"/>
      <path d="M58 92l21 4m33 0 23-4" stroke="${a}" stroke-width=".5"/>
    </g>
    <g data-detail="governed-record-core"><path d="m98 124 6 3v7l-6 4-6-4v-7Z" fill="#020812" stroke="${b}" stroke-width=".65"/><path d="m95 131 2 2 4-5" fill="none" stroke="#d1e4ec" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round"/></g>
    ${fastener(43,88,a,.75)}${fastener(148,88,b,.75)}
  </g>
  <g data-detail="rag-index">
    <path d="M36 100h5m-5 23h5" fill="none" stroke="#94a3b8" stroke-width=".7"/>
    <g data-detail="retrieval-lens"><circle cx="26" cy="111" r="14" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width=".9"/><circle cx="26" cy="111" r="10.5" fill="url(#glass)" stroke="${a}" stroke-width=".85"/>
      <g data-detail="retrieval-focus-reticle" fill="none" stroke="#afcddd" stroke-width=".5"><path d="M20 108v-3h3m6 0h3v3m0 6v3h-3m-6 0h-3v-3"/></g>
      <path d="M23.5 108.5h5v5h-5Z" fill="#092238" stroke="${b}" stroke-width=".7"/><path d="m34 122 9 10" stroke="url(#metal)" stroke-width="2.8" stroke-linecap="round"/>
      <g class="memory-query-ring" data-detail="retrieval-optic-index" data-motion-purpose="decorative-only" fill="none" stroke-width=".55"><path d="M13.5 111a12.5 12.5 0 0 1 12.5-12.5m12.5 12.5a12.5 12.5 0 0 1-12.5 12.5" stroke="#c3d9e7"/><path d="M26 97v2m14 12h-2m-12 14v-2m-14-12h2" stroke="${b}"/></g>
    </g>
  </g>
  <g data-detail="memory-lifecycle-bus"><path d="M154 91h5v53m0-60h4m-4 52h4" fill="none" stroke="#70879e" stroke-width=".65"/></g>
  <g data-detail="retention-gates" data-authority="owner-decision">
    ${['validity','accessibility','suppression','archive','reconsolidation','deletion-delay'].map((dimension,i)=>{
      const y=74+i*8;
      return `<g data-detail="retention-gate" data-dimension="${dimension}"><path d="M165 ${y}h14l5 3v4h-19l-3-3Z" fill="url(#dark-metal)" stroke="#8da6bb" stroke-width=".5"/><path data-detail="retention-policy-glyph" d="${glyphs[i]}" transform="translate(169 ${y+3.5}) scale(.63)" fill="none" stroke="#c6dae7" stroke-width=".5"/><circle cx="178" cy="${y+3.5}" r="1.25" fill="#020812" stroke="${i===5?'#fbbf24':i%2?b:a}" stroke-width=".5"/></g>`;
    }).join('')}
  </g>
  <g data-detail="archive-channel"><g data-detail="archive-cartridges" data-policy="reversible-archive">
    ${[127,137].map((y,i)=>`<g data-detail="archive-cartridge"><path d="M164 ${y}h15l5 4-5 5h-15Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".55"/><path data-detail="archive-media-window" d="M167 ${y+2}h10v5h-10Z" fill="#020812" stroke="#64748b" stroke-width=".35"/><g data-detail="cartridge-contact-bank"><path d="M169 ${y+3}v3m3-3v3m3-3v3" stroke="${i?b:a}" stroke-width=".5"/></g></g>`).join('')}
  </g><path data-detail="archive-egress" d="M159 136h5" stroke="#64748b" stroke-width=".5"/></g>
  <g data-detail="owner-confirmed-record-association"><path d="M66 146h9v6h-9Zm13 0h9v6h-9Z" fill="#020812" stroke="#9bb6ca" stroke-width=".5"/><path d="M73 149h8" stroke="${b}" stroke-width=".7"/></g>
  <g data-detail="backup-rail" data-purpose="backup-and-restore"><path d="M47 152h98l7 5-7 6H47l-6-6Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".65"/>
    <g data-detail="backup-mirror-channel"><path d="M56 155h32v5H56Zm49 0h32v5h-32Z" fill="#020812" stroke="#92a9c0" stroke-width=".4"/><path d="M60 156h5v3h-5Zm49 0h5v3h-5Zm-41 .5h16m-16 2h11m40-2h14m-14 2h10" fill="none" stroke="#a7bdd2" stroke-width=".35"/></g>
    <g data-detail="backup-module-latches"><path d="M53 155v5m88-5v5M59 153h24m27 0h25" stroke="#859cb6" stroke-width=".35"/></g>
    <g data-detail="backup-checkpoints"><circle cx="97" cy="157.5" r="2" fill="#020812" stroke="${a}" stroke-width=".55"/>${fastener(47,157,a,.65)}${fastener(146,157,b,.65)}</g>
  </g>`;
}
