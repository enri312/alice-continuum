// Estado.tsx / InternalState: inspect evidence, planned signals and locked controls.
export function stateObservatoryScene(a, b, { plinth, fastener, socket }) {
  const planned = ['curiosity', 'social', 'frustration', 'trust', 'fatigue', 'surprise'];
  const controls = ['autonomy', 'creativity', 'empathy', 'inhibition', 'stability', 'memory', 'anticipation', 'speed'];
  const controlPair = (x, pair) => `<g data-detail="locked-control-pair" data-state="locked-read-only" transform="translate(${x} 139)">
    <path d="M0 0h18l3 3v11l-3 3H0l-3-3V3Z" fill="url(#dark-metal)" stroke="#64748b" stroke-width=".5"/>
    <g data-detail="control-guide-index" stroke="#64748b" stroke-width=".3"><path d="M2 4h4m-4 4h4m5-4h4m-4 4h4"/></g>
    ${[0,1].map(i=>`<g data-control="${controls[pair*2+i]}"><path d="M${4+i*9} 3v10" stroke="#334155" stroke-width=".8"/><path d="M${1+i*9} 11h6v3h-6Z" fill="url(#metal)" stroke="#94a3b8" stroke-width=".35"/></g>`).join('')}
    <path d="M1 15h15" stroke="#94a3b8" stroke-width=".35"/>
    <g data-detail="locked-slider-grip" stroke="#aabbd0" stroke-width=".25"><path d="M2 12h4m5 0h4M3 4v5m9-5v5"/></g>
  </g>`;
  return `${plinth(a,b,156)}
  <g data-detail="read-only-state-console" filter="url(#shadow)">
    <path d="M25 144V55l18-20h114l18 20v89l-12 14H37Z" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width="1.15"/>
    <path d="M34 139V60l14-15h104l14 15v79H34Z" fill="#030b13" stroke="#475569" stroke-width=".65"/>
    <path d="M48 40h104M29 66v22m142-22v22M39 134h122" stroke="#94a3b8" stroke-width=".4"/>
    ${fastener(34,53,a,1)}${fastener(166,53,b,1)}${fastener(33,147,b,.8)}${fastener(167,147,a,.8)}
  </g>
  <g data-detail="technical-state-signals">
    <g data-metric="inhibition" data-availability="ready"><path d="M42 56h22l6 6v20H42l-5-5V62Z" fill="url(#dark-metal)" stroke="${b}" stroke-width=".65"/>
      <path d="m54 61 8 3v6l-8 7-8-7v-6Z" fill="#020812" stroke="${b}" stroke-width=".55"/><path d="M54 64v7m-3-3h6" stroke="#cbd5e1" stroke-width=".4"/>
      <path d="M44 80h18" stroke="#64748b" stroke-width=".4"/>
    </g>
    <g data-metric="memory" data-availability="ready"><path d="M42 88h22l6 6v20H42l-5-5V94Z" fill="url(#dark-metal)" stroke="${a}" stroke-width=".65"/>
      <path d="m54 92 9 4-9 4-9-4Zm-9 9 9 4 9-4m-18 5 9 4 9-4" fill="none" stroke="${a}" stroke-width=".55"/>
      <path d="M44 112h18" stroke="#64748b" stroke-width=".4"/>
    </g>
  </g>
  <g data-detail="state-inspection-links" fill="none" stroke="#64748b" stroke-width=".5"><path d="M69 69h6l7 7m-13 25h6l7-7M122 84h12" stroke-dasharray="2 1.5"/></g>
  <g data-detail="selected-state-inspector">
    <path d="M85 54h25l17 17v27l-17 17H85L69 98V71Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".75"/>
    <circle cx="98" cy="84" r="25" fill="#020812" stroke="#cbd5e1" stroke-width=".65"/>
    <circle cx="98" cy="84" r="21.8" fill="url(#glass)" stroke="${a}" stroke-width=".65"/>
    <path d="M81 82a17 17 0 0 1 13-15" fill="none" stroke="#e2e8f0" stroke-width=".4" opacity=".65"/>
    <g data-detail="inspection-aperture-brackets" fill="none" stroke="#94a3b8" stroke-width=".45"><path d="M87 78v-4h5m12 0h5v4m0 13v4h-5m-12 0h-5v-4"/></g>
    <g data-detail="read-only-metric-projection"><path d="M92 78h12v12H92Z" fill="#030914" stroke="${a}" stroke-width=".5"/><path d="M95 81h6m-6 3h6m-6 3h3" stroke="#cbd5e1" stroke-width=".5"/></g>
    <path class="pulse" d="M95 103h6" stroke="${a}" stroke-width=".55"/>
    ${fastener(98,58,a,.65)}${fastener(98,110,a,.65)}
  </g>
  <g data-detail="planned-state-reserve" data-state="inactive">
    ${planned.map((metric,i)=>{
      const x=135+(i%2)*14, y=59+Math.floor(i/2)*19;
      return `<g data-metric="${metric}" data-availability="planned"><path d="M${x} ${y}h10v15h-10Z" fill="#060d17" stroke="#475569" stroke-width=".4"/><path d="M${x+3} ${y+3}h4v5h-4Z" fill="none" stroke="#64748b" stroke-width=".35"/><path d="M${x+3} ${y+11}h4" stroke="#94a3b8" stroke-width=".35"/></g>`;
    }).join('')}
    <path d="M135 54h24m-24 62h24" stroke="#64748b" stroke-width=".4"/>
  </g>
  <g data-detail="retrieved-memory-cartridge"><path d="M43 120h114l5 5-5 8H43l-5-8Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".6"/>
    <path d="M47 123h15v7H47Zm4 0v7m4-7v7m4-7v7" fill="#020812" stroke="${a}" stroke-width=".4"/>
    <path d="M69 123h66v7H69Z" fill="#020812" stroke="#475569" stroke-width=".4"/><path d="M74 126.5h56" stroke="#64748b" stroke-width=".4" stroke-dasharray="2 2"/>
    <path d="M143 122h10v8h-10Z" fill="#020812" stroke="#64748b" stroke-width=".4"/><circle cx="148" cy="126" r="1" fill="#64748b"/>
  </g>
  <g data-detail="locked-behavior-control-deck" data-control-count="8">
    <path d="M42 137h116l5 5v12l-5 5H42l-5-5v-12Z" fill="#030914" stroke="#94a3b8" stroke-width=".6"/>
    ${controlPair(45,0)}${controlPair(70,1)}${controlPair(112,2)}${controlPair(137,3)}
    <g data-detail="read-only-interlock"><path d="M95 143h10v11H95Zm2 0v-3a3 3 0 0 1 6 0v3" fill="url(#dark-metal)" stroke="${b}" stroke-width=".75"/><circle cx="100" cy="148" r="1.1" fill="#cbd5e1"/><path d="M100 149v2" stroke="#cbd5e1" stroke-width=".5"/></g>
  </g>
  <g data-detail="state-observation-port"><path d="M22 103h12" stroke="#64748b" stroke-width=".5"/>${socket(20,103,a,b,4.2)}</g>`;
}
