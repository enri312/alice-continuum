// Maps Configuracion.tsx: inference selection, local policy and safe-off hardware.
export function settingsConsoleScene(a, b, { plinth, fastener, detailedGear, gearAxisSupport, fiberOpticHarness }) {
  const housing = (y, color, content, domain) => `<g data-detail="etched-hardware-module" data-settings-domain="${domain}">
    <path d="M140 ${y}h35l7 7v23l-7 7h-35l-6-6V${y+6}Z" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width=".72"/>
    <path d="M142 ${y+5}h29l6 5v17l-5 5h-30Z" fill="#030a14" stroke="${color}" stroke-width=".45"/>
    <path d="M140 ${y+3}h17M179 ${y+12}v12" stroke="#94a3b8" stroke-width=".32"/>
    <g data-detail="settings-module-keyed-bezel" fill="none" stroke="#a7b9cb" stroke-width=".28"><path d="M143 ${y+7}v5m29 1h3m-3 4h3m-3 4h3M145 ${y+30}h7m7 0h7"/></g>
    ${content}${fastener(138,y+7,color,.58)}${fastener(177,y+30,color,.58)}
  </g>`;
  return `${plinth(a,b,160)}
  <g data-detail="system-configuration-backplane" filter="url(#shadow)">
    <path d="M18 140V51l17-20h128l23 22v88l-12 13H32Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width="1.05"/>
    <path d="M25 136V56l15-17h119l19 18v78l-10 11H36Z" fill="#030914" stroke="#334155" stroke-width=".65"/>
    <path d="M40 35h114m-125 26v18m153-16v16M35 149h20m48 0h58" stroke="#cbd5e1" stroke-width=".44"/>
    <g data-detail="backplane-machined-seams" stroke="#475569" stroke-width=".4"><path d="M30 61h14m-14 5h10M165 40v8m5-3v9M28 120v14l8 8" fill="none"/></g>
    ${fastener(29,52,a,1)}${fastener(169,48,b,1)}${fastener(28,140,a,1)}${fastener(177,140,b,1)}
  </g>
  ${fiberOpticHarness(a,b)}
  <g data-detail="manual-runtime-switch-bank">
    <path d="M44 38h62l6 5-6 9H44l-6-9Z" fill="url(#dark-metal)" stroke="#64748b" stroke-width=".6"/>
    <g data-detail="runtime-start-stop-controls" fill="none" stroke="#94a3b8" stroke-width=".55">
      <circle cx="51" cy="45" r="3.6"/><path d="M51 40v4m13-3h7v7h-7Z"/>
    </g>
    <path d="M78 41v8M84 43h17m-17 4h11" stroke="#64748b" stroke-width=".4"/>
    <circle cx="104" cy="45" r="1.4" fill="#334155" stroke="#94a3b8" stroke-width=".3"/>
  </g>
  ${gearAxisSupport(70,a,b)}
  <g data-detail="mechanical-inference-selector">
    ${detailedGear(70,101,41,a,b)}
    <g data-detail="fixed-selector-index"><path d="M14 95h7v12h-7" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".55"/><path d="M17 101h8" stroke="${a}" stroke-width=".7"/></g>
  </g>
  ${housing(46,a,`
    <g data-detail="provider-model-cartridges">
      <path d="M145 55h12v11h-12Zm17 0h10v11h-10Z" fill="url(#metal)" stroke="#94a3b8" stroke-width=".4"/>
      <path d="M148 58h6v5h-6Zm16 0h6v5h-6Z" fill="#020812" stroke="${a}" stroke-width=".4"/>
      <path d="M147 53v2m4-2v2m4-2v2m8-2v2m4-2v2m4-2v2M147 66v2m4-2v2m4-2v2m8-2v2m4-2v2m4-2v2" stroke="#94a3b8" stroke-width=".32"/>
    </g>
    <g data-detail="explicit-provider-selection"><path d="M151 69v4h14v-4" fill="none" stroke="#64748b" stroke-width=".4"/><circle cx="151" cy="73" r="1.7" fill="#030914" stroke="${a}" stroke-width=".45"/><path d="M156 77h14" stroke="#94a3b8" stroke-width=".4"/></g>
  `,'inference')}
  ${housing(84,'#a78bfa',`
    <g data-detail="mandatory-send-review"><path d="M146 93h11l4 4v14h-15Z" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width=".5"/><path d="M157 93v4h4M149 99h7m-7 4h5" fill="none" stroke="#94a3b8" stroke-width=".35"/>
      <path d="M162 104h10v9h-10Zm2 0v-3a3 3 0 0 1 6 0v3" fill="#020812" stroke="#a78bfa" stroke-width=".65"/><circle cx="167" cy="108" r="1" fill="${b}"/>
    </g>
    <g data-detail="remote-tools-disabled"><path d="M146 116h11m8 0h8m-14-2v4m3-4v4" stroke="#94a3b8" stroke-width=".4"/></g>
  `,'privacy')}
  ${housing(122,b,`
    <g data-detail="external-hardware-safe-off"><path d="M146 133h23l3 3v7l-5-1-4-3h-10l-4 3-5 1v-7Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".6"/>
      <path d="M150 134v5m-2.5-2.5h5" stroke="${b}" stroke-width=".55"/><circle cx="165" cy="134" r=".8" fill="#64748b"/><circle cx="168" cy="137" r=".8" fill="#64748b"/>
      <path d="M149 148h7m6 0h9m-12-3v6" stroke="#64748b" stroke-width=".5"/><circle cx="174" cy="129" r="1.2" fill="#334155" stroke="#94a3b8" stroke-width=".3"/>
    </g>
  `,'hardware')}`.replace(/[ \t]+$/gm, '');
}
