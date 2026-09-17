// Functional graph from CognitiveFlow; illustrative structure, never live R3 telemetry.
export function evidenceFlowScene(a, b, { plinth, fastener }) {
  const links = [
    ['inhibition','input','M41 56v9'], ['input','workspace','M55 78h14l9 10'],
    ['memory','workspace','M55 111h13l10-11'], ['language','workspace','M100 60v10'],
    ['workspace','response','M126 94h17'],
  ];
  const planned = [
    ['social','M-4-2h5v3h-2l-2 2V1h-1Zm6 1h2v3H2'],
    ['self','M0-3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3M-3 3V2l3-2 3 2v1'],
    ['affect','M-4 0h2l1-2 2 4 1-2h2'],
    ['face','M-3-2q3-2 6 0v3L0 3-3 1Zm1 1h1m2 0h1m-3 2h2'],
    ['body','M0-3v3m-3-1 3-1 3 1M0 0l-2 3m2-3 2 3'],
  ];
  return `<style>
    [data-icon="flow"] .alive{animation:none}
    .flow-optical-sheen{animation:flow-optical-sheen 4.2s ease-in-out infinite}
    @keyframes flow-optical-sheen{0%,100%{opacity:.25}50%{opacity:.95}}
    @media(prefers-reduced-motion:reduce){.flow-optical-sheen{animation:none}}
  </style><defs>
    <linearGradient id="workspace-plane" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a4bad0"/><stop offset=".26" stop-color="#4a426c"/><stop offset=".56" stop-color="#17243c"/><stop offset="1" stop-color="#544465"/></linearGradient>
  </defs>
  ${plinth(a,b,160)}
  <g data-detail="functional-flow-console" filter="url(#shadow)">
    <path d="M24 144V55l19-20h114l19 20v89l-11 11H35Z" fill="url(#dark-metal)" stroke="#b9c7db" stroke-width="1.1"/>
    <path d="M32 136V59l16-16h104l16 16v77Z" fill="#050b17" stroke="#4e627d" stroke-width=".55"/>
    <path d="M44 39h112M28 65v60m144-60v60M40 151h119" stroke="#a3b1c8" stroke-width=".35"/>
    ${fastener(34,52,a,1.3)}${fastener(166,52,b,1.3)}${fastener(33,145,b,1.2)}${fastener(167,145,a,1.2)}
  </g>
  <g data-detail="evidenced-functional-links" data-representation="illustrative-not-live" fill="none">
    ${links.map(([from,to,d])=>`<g data-detail="functional-route" data-from="${from}" data-to="${to}"><path d="${d}" stroke="#02050c" stroke-width="3.1"/><path d="${d}" stroke="#8e9eb8" stroke-width=".9"/><path d="${d}" stroke="${a}" stroke-width=".35"/></g>`).join('')}
    ${[[62,78],[62,111],[100,65],[134,94]].map(([x,y])=>`<g data-detail="route-coupling"><path d="M${x-2} ${y-2}h4v4h-4Z" fill="#102039" stroke="#9eabc2" stroke-width=".35"/><path d="M${x} ${y-1}v2" stroke="${b}" stroke-width=".4"/></g>`).join('')}
  </g>
  <g data-detail="perception-inhibition-gate"><path d="M31 44h20v12H31Z" fill="url(#dark-metal)" stroke="#a6b5c9" stroke-width=".5"/><path d="M38 48h6v5h-6Zm1 0v-2a2 2 0 0 1 4 0v2" fill="#07101d" stroke="#bba5ce" stroke-width=".45"/></g>
  <g data-detail="perception-input-node"><path d="M29 68h21l7 7v12H29Z" fill="url(#dark-metal)" stroke="#b0bfd3" stroke-width=".65"/><path d="M34 73h16v8h-9l-4 3v-3h-3Zm3 3h9" fill="#0a1728" stroke="#79d6e9" stroke-width=".5"/>${fastener(32,85,a,.7)}</g>
  <g data-detail="memory-context-node"><path d="M28 97h24l5 6v18H28Z" fill="url(#dark-metal)" stroke="#a8bad1" stroke-width=".65"/><path d="m34 105 9-4 9 4-9 4Zm0 4 9 4 9-4m-18 4 9 4 9-4" fill="#102137" stroke="#a4b9cf" stroke-width=".55"/><path d="M32 103v14" stroke="${a}" stroke-width=".4"/></g>
  <g data-detail="language-process-node"><path d="M86 38h28l5 6v13l-5 5H86l-5-5V44Z" fill="url(#dark-metal)" stroke="#9caec7" stroke-width=".6"/><path d="M87 44h17v8H94l-4 3v-3h-3Zm9 10h14v-8h-3" fill="none" stroke="#c5c5e3" stroke-width=".5"/><path d="M91 47h9m0 10h8" stroke="${b}" stroke-width=".4"/></g>
  <g data-detail="global-workspace-hub">
    <path d="m100 66 26 15v27l-26 15-26-15V81Z" fill="url(#metal)" stroke="#c6cde1" stroke-width=".85"/>
    <path d="m100 71 21 12v22l-21 12-21-12V83Z" fill="#081224" stroke="#8d88b7" stroke-width=".55"/>
    <g data-detail="workspace-integration-layers">${[0,1,2].map(i=>`<g data-detail="workspace-layer"><path d="m100 ${80+i*9} 16 8v3l-16 8-16-8v-3Z" fill="url(#workspace-plane)" stroke="#afbad2" stroke-width=".45"/><path d="m84 ${88+i*9} 16 8 16-8" fill="none" stroke="${i===1?b:a}" stroke-width=".55"/><path d="m89 ${87+i*9} 5-2 6 3 6-3 5 2m-21 5 2 1m2 1 2 1m8 0 2-1m2-1 2-1" fill="none" stroke="#b5bcd2" stroke-width=".3"/><circle cx="100" cy="${94+i*9}" r=".65" fill="#b0a0cc"/></g>`).join('')}</g>
    <path data-detail="workspace-evidence-aperture" d="m100 84 7 4-7 4-7-4Z" fill="#080d1c" stroke="#c8c3e0" stroke-width=".5"/>
    <path d="M98 88h4" stroke="${b}" stroke-width=".55"/>
    ${[[100,69],[124,83],[124,106],[100,120],[76,106],[76,83]].map(([x,y],i)=>fastener(x,y,i%2?a:b,.8)).join('')}
    <g data-detail="workspace-rim-illumination" data-motion-purpose="decorative-only"><path class="flow-optical-sheen" d="m78 81 22-13 22 13m0 28-22 12-22-12" fill="none" stroke="#c5baff" stroke-width=".7" filter="url(#soft-glow)"/></g>
  </g>
  <g data-detail="governed-response-port"><path d="M146 79h21l8 8v16l-8 7h-21l-5-7V87Z" fill="url(#dark-metal)" stroke="#b3c1d6" stroke-width=".65"/><path d="M147 86h20v12h-9l-4 4v-4h-7Zm4 4h12m-12 4h8" fill="#081324" stroke="#d29abb" stroke-width=".5"/><path d="M150 105h14" stroke="#778fa9" stroke-width=".4"/>${fastener(170,100,b,.75)}</g>
  <g data-detail="r3-evidence-monitor" data-state="unmeasured"><path d="M133 46h24l6 7v14h-30Z" fill="url(#dark-metal)" stroke="#899bb5" stroke-width=".55"/><path d="M137 51h7v11h-7Zm10 1h9m-9 4h7m-7 4h9" fill="#071120" stroke="#9babbe" stroke-width=".4"/><path d="M139 55h3m-3 3h3" stroke="#c6b8da" stroke-width=".4"/></g>
  <g data-detail="planned-function-satellites" data-state="planned">
    <path d="M65 130h76m-41-6v6" fill="none" stroke="#56647c" stroke-width=".45" stroke-dasharray="1.5 2"/>
    ${planned.map(([name,glyph],i)=>`<g data-planned-function="${name}"><path d="M${56+i*19} 133h14v8h-14Z" fill="#070c16" stroke="#6d7b91" stroke-width=".4" stroke-dasharray="1.5 1.5"/><path d="M${63+i*19} 130v3" stroke="#72809a" stroke-width=".4"/><path d="${glyph}" transform="translate(${63+i*19} 137) scale(.8)" fill="none" stroke="#8393aa" stroke-width=".4"/></g>`).join('')}
  </g>
  <g data-detail="owner-confirmed-memory-association" data-relation="not-causal">
    <path d="M65 145h70v9H65Z" fill="url(#dark-metal)" stroke="#8496b0" stroke-width=".45"/>
    <path d="M71 147h13v5H71Zm45 0h13v5h-13Zm-28 2h7m10 0h7" fill="#081321" stroke="#abb9cd" stroke-width=".4"/>
    <path d="m96 149 3 3 5-6" fill="none" stroke="#b9a8d0" stroke-width=".65"/>
    <path d="M74 149h7m38 0h7" stroke="#819bb6" stroke-width=".3"/>
  </g>`;
}
