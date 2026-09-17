// Read-only R1 inventory. Maturity, runtime state and health are separate concepts.
export function capabilityRegistryScene(a, b, { plinth, fastener, socket }) {
  const domains = [
    ['cloud', 'M-5 2a3 3 0 0 1 0-6 4 4 0 0 1 7-1 3 3 0 0 1 3 5H-5Z'],
    ['context', 'M-5-4H5v6H0l-3 3V2h-2Z'],
    ['perception', 'M-6 0Q0-7 6 0 0 7-6 0Zm6-2v4m-2-2h4'],
    ['memory', 'm0-5 6 3-6 3-6-3Zm-6 5 6 3 6-3'],
    ['avatar', 'M-2-3a2 2 0 1 0 4 0 2 2 0 1 0-4 0M-5 5V3l5-3 5 3v2'],
    ['output', 'M-5-4H5v6H-5Zm3 9h6M0 2v3'],
    ['task', 'M-4-5h8V5h-8Zm2 3h4m-4 3h4'],
  ];
  const drawers = domains.map(([domain,glyph],i)=>{
    const y=57+i*11.5;
    const selected=i===3;
    return `<g data-detail="capability-domain-cartridge" data-domain="${domain}" data-selected="${selected}">
      <path d="M${selected?44:40} ${y}h60l5 4v5l-5 2H${selected?44:40}Z" fill="url(#dark-metal)" stroke="${selected?a:'#64748b'}" stroke-width="${selected?.7:.45}"/>
      <path d="${glyph}" transform="translate(${selected?53:49} ${y+5.5}) scale(.63)" fill="none" stroke="${selected?a:'#cbd5e1'}" stroke-width=".75" stroke-linejoin="round"/>
      <path d="M${selected?64:60} ${y+3.5}h27m-27 3.5h18" stroke="#94a3b8" stroke-width=".4"/>
      <path d="M${selected?99:95} ${y+3}v5m3-5v5" stroke="${selected?a:'#64748b'}" stroke-width=".35"/>
    </g>`;
  }).join('');
  return `${plinth(a,b,154)}
  <g data-detail="capability-registry-chassis" filter="url(#shadow)">
    <path d="M26 146V54l18-20h112l18 20v92l-10 11H36Z" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width="1.15"/>
    <path d="M35 137V59l13-15h104l13 15v78Z" fill="#030914" stroke="#475569" stroke-width=".65"/>
    <path d="M44 38h112M31 66v22m138-22v22M41 139h118" stroke="#94a3b8" stroke-width=".4"/>
    ${fastener(34,52,a,1)}${fastener(166,52,b,1)}${fastener(34,147,b,.8)}${fastener(166,147,a,.8)}
  </g>
  <g data-detail="registry-backplane"><path d="M37 61v70m72-72v70" stroke="#475569" stroke-width=".55"/>${domains.map((_,i)=>`<path d="M35 ${62+i*11.5}h7m62 0h7" stroke="#94a3b8" stroke-width=".4"/>`).join('')}</g>
  <g data-detail="domain-inventory-drawers">${drawers}</g>
  <g data-detail="capability-maturity-legend">
    ${['implemented','partial','planned'].map((maturity,i)=>`<g data-maturity="${maturity}"><path d="M${45+i*20} 44h15v8h-15Z" fill="#020812" stroke="#64748b" stroke-width=".4"/><path d="M${48+i*20} 48h9" stroke="${i===2?'#64748b':a}" stroke-width=".65" ${i?'stroke-dasharray="'+(i===1?'4 5':'1 2')+'"':''}/></g>`).join('')}
  </g>
  <g data-detail="registry-query-port"><path d="M118 33v18h14" fill="none" stroke="#64748b" stroke-width="1.1"/><circle cx="118" cy="28" r="7" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".65"/><circle cx="118" cy="28" r="4.5" fill="#020812" stroke="${a}" stroke-width=".45"/><path d="M116 27h4m-4 2h3" stroke="#cbd5e1" stroke-width=".35"/></g>
  <g data-detail="selected-capability-inspector">
    <path d="M119 54h32l9 9v63l-7 8h-34l-5-5V59Z" fill="url(#dark-metal)" stroke="${a}" stroke-width=".8"/>
    <path d="M151 54v10h9" fill="none" stroke="#94a3b8" stroke-width=".45"/>
    <g data-detail="registry-inspector-guide-rails" fill="none" stroke="#94a9bf" stroke-width=".3"><path d="M116 67v56m42-51v49m-3-43h3m-3 8h3m-3 8h3m-3 8h3M122 58h20"/></g>
    <g data-detail="versioned-adapter-descriptor"><path d="M125 65h22v21h-22Z" fill="#020812" stroke="#94a3b8" stroke-width=".55"/><path d="M130 70h12v10h-12Z" fill="url(#glass)" stroke="${b}" stroke-width=".55"/>
      ${[129,134,139,144].map(x=>`<path d="M${x} 62v3m0 21v3" stroke="#94a3b8" stroke-width=".35"/>`).join('')}
      <path d="M122 69h3m-3 5h3m-3 5h3m22-10h3m-3 5h3m-3 5h3" stroke="#94a3b8" stroke-width=".35"/>
    </g>
    <g data-detail="descriptor-contract-fields">${['operations','effects','dataScopes','requirements'].map((field,i)=>`<g data-field="${field}"><circle cx="123" cy="${95+i*7}" r=".8" fill="${i%2?a:b}"/><path d="M128 ${93+i*7}h21m-21 3h${i%2?12:16}" stroke="#94a3b8" stroke-width=".4"/></g>`).join('')}</g>
    <path d="M121 129h31" stroke="#64748b" stroke-width=".35"/>
  </g>
  <g data-detail="selection-query-link"><path d="M109 96h5" stroke="${a}" stroke-width=".6"/><circle class="pulse" cx="111" cy="96" r="1" fill="${a}"/></g>
  <g data-detail="permission-risk-health-strip"><path d="M119 135h41v19h-41Z" fill="#020812" stroke="#64748b" stroke-width=".55"/>
    <g data-field="permission"><path d="M123 143h7v7h-7Zm1 0v-2a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="${b}" stroke-width=".55"/></g>
    <g data-field="risk"><path d="m139 139 5 5-5 5-5-5Z" fill="none" stroke="#94a3b8" stroke-width=".5"/><path d="M139 142v3" stroke="#94a3b8" stroke-width=".5"/></g>
    <g data-field="health"><circle cx="152" cy="144" r="4" fill="none" stroke="#64748b" stroke-width=".5"/><path d="M150 144h4" stroke="#94a3b8" stroke-width=".45"/></g>
  </g>
  <g data-detail="runtime-state-legend">${['unavailable','disabled','idle','active','degraded','error'].map((state,i)=>`<g data-state="${state}" transform="translate(${45+i*12} 148)"><path d="M-4-5h8v10h-8Z" fill="#020812" stroke="#475569" stroke-width=".35"/><path d="${['M-2 0h4','M-2-2 2 2','M-2-2H2v4H-2Z','M0-2v4m-2-2h4','M0-3v3m0 2v.5','M-2-2 2 2m0-4-4 4'][i]}" fill="none" stroke="${i>3?'#fbbf24':i===3?b:'#94a3b8'}" stroke-width=".5"/></g>`).join('')}</g>
  <g data-detail="registry-input-port"><path d="M25 98h8" stroke="#64748b" stroke-width=".55"/>${socket(20,98,a,b,4.5)}</g>`;
}
