// Local text diagnostics, not biometric identification. Documents have an isolated preview.
export function inputIdentificationScene(a, b, { plinth, fastener }) {
  const fields = [['source','observed'],['speaker','observed'],['intent','heuristic'],['confidence','heuristic']];
  const modes = [['live','M-2-3 3 0-2 3Z'],['step','M-3-3 1 0-3 3Zm6 0v-6'],['pause','M-2-3v6m4-6v6'],['inspect','M0-3a3 3 0 1 0 0 6 3 3 0 1 0 0-6m2 5 2 2']];
  return `<style>
    [data-icon="identification"] .alive{animation:none}
    .input-lens-glint{animation:input-lens-glint 3.8s ease-in-out infinite}
    .input-reader-index{animation:input-reader-index 4.4s ease-in-out infinite}
    @keyframes input-lens-glint{0%,100%{opacity:.3}50%{opacity:1}}
    @keyframes input-reader-index{0%,100%{transform:translateY(0)}50%{transform:translateY(24px)}}
    @media(prefers-reduced-motion:reduce){.input-lens-glint,.input-reader-index{animation:none}}
  </style><defs>
    <radialGradient id="input-optical-glass" cx=".35" cy=".25" r=".8"><stop stop-color="#284d66"/><stop offset=".42" stop-color="#102538"/><stop offset="1" stop-color="#030b18"/></radialGradient>
    <linearGradient id="input-reader-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#abc1cf"/><stop offset=".2" stop-color="#3a536a"/><stop offset=".5" stop-color="#15283c"/><stop offset=".75" stop-color="#607a90"/><stop offset="1" stop-color="#16283d"/></linearGradient>
  </defs>
  ${plinth(a,b,158)}
  <g data-detail="local-perception-diagnostic-chassis" filter="url(#shadow)">
    <path d="M25 144V51l17-18h117l17 18v93l-11 11H36Z" fill="url(#dark-metal)" stroke="#b9cadb" stroke-width="1.1"/>
    <path d="M33 136V56l13-14h108l14 14v80Z" fill="#040c17" stroke="#4e657e" stroke-width=".55"/>
    <path d="M43 37h113M29 64v29m0 10v25m143-64v64M40 151h119" stroke="#9baec4" stroke-width=".35"/>
    ${fastener(35,48,a,1.3)}${fastener(165,48,b,1.3)}${fastener(34,145,b,1.2)}${fastener(166,145,a,1.2)}
  </g>
  <g data-detail="active-input-inspection-cassette">
    <path d="M54 43h62l13 13v76l-8 7H54l-8-7V51Z" fill="url(#input-reader-metal)" stroke="#a9bed0" stroke-width=".75"/>
    <path d="M116 43v13h13M52 65v61m6 10h58" fill="none" stroke="#c6d5df" stroke-width=".4"/>
    <path d="M57 68h61v57H57Z" fill="#05101f" stroke="#344c68" stroke-width=".5"/>
    <path d="M59 71h14m31 0h11M59 122h16m28 0h12" stroke="#6b879f" stroke-width=".35"/>
    ${fastener(51,54,a,.8)}${fastener(122,130,b,.8)}
  </g>
  <g data-detail="local-source-multiplexer">
    <g data-source="draft"><path d="M60 47h24l4 4v11H60Z" fill="#081321" stroke="#8da6bd" stroke-width=".5"/><path d="M65 52h10m-10 4h7m6-6 3 3-5 5-3 1 1-3Z" fill="none" stroke="${a}" stroke-width=".5"/></g>
    <g data-source="last-user-message"><path d="M92 47h20l4 4v11H92Z" fill="#081321" stroke="#8da6bd" stroke-width=".5"/><path d="M97 50h13v7h-7l-4 3v-3h-2Zm3 3h7" fill="none" stroke="#b9cadb" stroke-width=".5"/></g>
    <path d="M73 63v2h12m19-2v2H92" fill="none" stroke="#68839d" stroke-width=".4"/>
  </g>
  <g data-detail="real-local-input-ingress" data-source-kind="conversation-text">
    <path d="M32 75h12v25H32Z" fill="url(#dark-metal)" stroke="#839ab2" stroke-width=".55"/>
    <path d="M36 79h5m-5 4h3m-3 4h5m-5 4h3m-3 4h5M44 87h9" stroke="#b4c8d7" stroke-width=".45"/>
    <path d="M54 73v28" stroke="#4a647b" stroke-width=".4"/>
    <g data-motion-purpose="decorative-only"><path class="input-reader-index" d="M52 74h4" stroke="${a}" stroke-width=".95" filter="url(#soft-glow)"/></g>
  </g>
  <g data-detail="token-inspection-optic">
    <g data-detail="lens-handle-assembly"><path d="m112 108 8-2 16 23-7 7-22-21Z" fill="url(#metal)" stroke="#9bafc5" stroke-width=".65"/><path d="m117 113 13 17" stroke="#08111d" stroke-width="2.6"/><path d="m118 112 13 17" stroke="#a9bcd0" stroke-width=".45"/>${[0,1,2].map(i=>`<path d="m${119+i*3} ${118+i*3} 4-3" stroke="#c0cddd" stroke-width=".4"/>`).join('')}${fastener(130,130,b,1)}</g>
    <circle cx="89" cy="93" r="31" fill="url(#metal)" stroke="#c3d7e4" stroke-width=".85"/>
    <circle cx="89" cy="93" r="28.5" fill="#040b17" stroke="#647f99" stroke-width=".55"/>
    <circle cx="89" cy="93" r="26" fill="url(#input-optical-glass)" stroke="${a}" stroke-width=".6"/>
    <g data-detail="optic-calibration-index" stroke="#a4bcd0" stroke-width=".4">${Array.from({length:16},(_,i)=>`<path d="M89 63v1.4" transform="rotate(${i*22.5} 89 93)"/>`).join('')}</g>
    <g data-detail="tokenized-message-window"><path d="M72 76h34l5 5v24h-15l-7 6v-6H71V81Z" fill="#071321" stroke="#a9bdcf" stroke-width=".55"/><path d="M75 80h26m-26 3h16" stroke="#6e8aa3" stroke-width=".4"/>
      <g data-detail="real-input-token-cells" data-representation="illustrative">${Array.from({length:8},(_,i)=>{const x=75+(i%4)*8;const y=87+Math.floor(i/4)*9;return `<g data-token-index="${i}"><path d="M${x} ${y}h6v6h-6Z" fill="${i===2?'#163a50':'#0f2035'}" stroke="${i===2?a:'#7d94b0'}" stroke-width=".4"/><path d="M${x+1.5} ${y+2}h3m-3 2h${i%2?1.5:3}" stroke="${i===2?'#c7f6ff':'#afc0d2'}" stroke-width=".35"/></g>`;}).join('')}</g>
    </g>
    <g data-detail="optical-rim-highlight" data-motion-purpose="decorative-only"><path class="input-lens-glint" d="M66 90a23 23 0 0 1 22-20m4 46a23 23 0 0 0 18-13" fill="none" stroke="#b4effb" stroke-width=".9" filter="url(#soft-glow)"/></g>
    <path d="M73 73q9-5 17-3" fill="none" stroke="#e4f7ff" stroke-width="1.1" opacity=".35"/>
    ${fastener(89,63,a,.85)}${fastener(59,93,a,.85)}${fastener(119,93,b,.85)}${fastener(89,123,b,.85)}
  </g>
  <g data-detail="perception-provenance-vector" data-representation="evidence-legend">
    <path d="M140 54h22l8 8v64l-6 9h-24Z" fill="url(#dark-metal)" stroke="#a3b6cc" stroke-width=".7"/>
    <path d="M144 58h15m-17 5v62M145 131h16" stroke="#b4c6d7" stroke-width=".3"/>
    ${fields.map(([field,evidence],i)=>{const y=64+i*16;return `<g data-detail="provenance-field-cell" data-field="${field}" data-evidence="${evidence}"><path d="M144 ${y}h17l5 4v9h-22Z" fill="#040b16" stroke="#637d97" stroke-width=".4"/>${evidence==='observed'?`<circle cx="149" cy="${y+5}" r="1.6" fill="${a}" stroke="#b9eff9" stroke-width=".3"/>`:`<path d="m149 ${y+2} 2.5 3-2.5 3-2.5-3Z" fill="none" stroke="${b}" stroke-width=".6"/>`}<path d="M154 ${y+4}h7m-7 3h5M147 ${y+10}h12" stroke="#a7bbce" stroke-width=".35"/></g>`;}).join('')}
  </g>
  <g data-detail="isolated-document-preview" data-flow="preview-only" data-memory-write="false">
    <path d="M28 108h15l8 7v22H28Z" fill="url(#dark-metal)" stroke="#98aec5" stroke-width=".55"/><path d="M43 108v7h8" fill="none" stroke="#bccad8" stroke-width=".4"/>
    <path d="M33 115h6m-6 4h12m-12 4h9" stroke="#92aac3" stroke-width=".4"/>
    <path d="m37 127 4 2v5h-8v-5Zm-2 2v-2a2 2 0 0 1 4 0v2" fill="#071121" stroke="#a6b8cd" stroke-width=".4"/>
    <path d="M54 110v26" stroke="#536881" stroke-width=".35" stroke-dasharray="1.5 2"/>
  </g>
  <g data-detail="diagnostic-mode-deck">
    <path d="M58 139h69l6 6-6 8H58l-6-8Z" fill="url(#dark-metal)" stroke="#a1b5cc" stroke-width=".6"/>
    ${modes.map(([mode,glyph],i)=>`<g data-detail="diagnostic-mode-cell" data-mode="${mode}"><path d="M${61+i*16} 142h12v8h-12Z" fill="#050c17" stroke="#647c97" stroke-width=".4"/><path d="${glyph}" transform="translate(${67+i*16} 146) scale(.75)" fill="${mode==='live'?a:'none'}" stroke="${i===0?a:'#b2c4d7'}" stroke-width=".55" stroke-linejoin="round"/></g>`).join('')}
  </g>
  <g data-detail="local-failsafe-isolator"><path d="M140 140h20l5 5-5 8h-20Z" fill="url(#dark-metal)" stroke="#7f96b0" stroke-width=".5"/><path d="M146 145h7v6h-7Zm1 0v-2a2.5 2.5 0 0 1 5 0v2" fill="#06101c" stroke="#a5b8ce" stroke-width=".45"/>
    <g data-detail="affect-simulation-off" data-state="off"><circle cx="159" cy="147" r="2.2" fill="#091220" stroke="#7d8ca5" stroke-width=".35"/><path d="m157.5 148.5 3-3" stroke="#a997b6" stroke-width=".4"/></g>
  </g>`;
}
