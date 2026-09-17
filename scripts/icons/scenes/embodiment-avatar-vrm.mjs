// Vector portrait based on the embedded thumbnail in the project's local Alice VRM.
// The private model and its textures remain untouched; no bitmap is embedded here.
export function avatarMiniatureScene(a, b, { plinth, fastener }) {
  const boundaries = ['render', 'expression', 'voice', 'cognition'];
  return `<style>
    [data-icon="avatar"] .alive{animation:none}
    .avatar-preview-portrait{animation:avatar-preview-breathe 4.8s ease-in-out infinite}
    .avatar-preview-eyes{transform-box:fill-box;transform-origin:center;animation:avatar-preview-blink 5.6s linear infinite}
    .avatar-panel-sweep{animation:avatar-panel-sweep 3.8s ease-in-out infinite}
    @keyframes avatar-preview-breathe{50%{transform:translateY(-.65px)}}
    @keyframes avatar-preview-blink{0%,41%,47%,100%{transform:scaleY(1)}44%{transform:scaleY(.07)}}
    @keyframes avatar-panel-sweep{0%,100%{transform:translateY(0);opacity:.3}50%{transform:translateY(39px);opacity:1}}
    @media(prefers-reduced-motion:reduce){.avatar-preview-portrait,.avatar-preview-eyes,.avatar-panel-sweep{animation:none}}
  </style><defs>
    <linearGradient id="alice-hair" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#665e59"/><stop offset=".28" stop-color="#b3a594"/><stop offset=".48" stop-color="#d8c7b2"/><stop offset=".65" stop-color="#9c9185"/><stop offset="1" stop-color="#635e59"/></linearGradient>
    <linearGradient id="alice-fringe" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#918579"/><stop offset=".38" stop-color="#baab98"/><stop offset=".54" stop-color="#e0ceb8"/><stop offset=".65" stop-color="#bdad99"/><stop offset="1" stop-color="#958b80"/></linearGradient>
    <radialGradient id="alice-skin" cx=".48" cy=".36" r=".75"><stop stop-color="#fff0e4"/><stop offset=".65" stop-color="#f2dbce"/><stop offset="1" stop-color="#c89f96"/></radialGradient>
    <linearGradient id="alice-iris" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#5e5c80"/><stop offset=".48" stop-color="#929cb1"/><stop offset="1" stop-color="#c0d8d0"/></linearGradient>
    <linearGradient id="alice-cloth" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#48505a"/><stop offset=".3" stop-color="#24282e"/><stop offset=".7" stop-color="#101419"/><stop offset="1" stop-color="#3b424c"/></linearGradient>
  </defs>
  ${plinth(a,b,158)}
  <g data-detail="local-vrm-inspection-gantry" filter="url(#shadow)">
    <path d="M27 144V47l15-17h116l17 17v97l-10 10H37Z" fill="url(#dark-metal)" stroke="#a8b5c7" stroke-width="1.1"/>
    <path d="M35 140V50l12-12h99v102Z" fill="#050c15" stroke="#475569" stroke-width=".55"/>
    <path d="M45 34h104M31 57v37m0 9v27M150 45v88M42 149h115" stroke="#a8b5c7" stroke-width=".35"/>
    <path d="M37 61V52l9-10h16m72 0h8v19M38 118v19h12" fill="none" stroke="${b}" stroke-width=".65"/>
    <g data-detail="viewer-bezel-machining" fill="none" stroke-width=".35">
      <path d="M29 68h3v17h-3m0 23h3v17h-3M146 38h7l9 9M43 151h21m84 0h11" stroke="#64748b"/>
      <path d="M38 67v45m-1-42h2m-2 7h2m-2 7h2m-2 7h2m-2 7h2m-2 7h2m-2 7h2" stroke="#93a8bc"/>
      <path d="M44 36h17m74 0h15M30 70v12m0 29v11" stroke="${b}" opacity=".55"/>
    </g>
    <g data-detail="decorative-viewer-sweep" data-motion-purpose="decorative-only"><path class="avatar-panel-sweep" d="M37 70h2m-1-2v4" fill="none" stroke="${b}" stroke-width=".75" filter="url(#soft-glow)"/></g>
    ${fastener(37,42,b,1.4)}${fastener(164,43,a,1.4)}${fastener(35,144,a,1.15)}${fastener(166,145,b,1.15)}
  </g>
  <g data-detail="vrm-local-render-stage">
    <path d="M44 137h98l-7 9H51Z" fill="url(#metal)" stroke="#94a3b8" stroke-width=".55"/>
    <ellipse cx="93" cy="138" rx="44" ry="5" fill="#020409" stroke="${b}" stroke-width=".45"/>
  </g>
  <g class="avatar-preview-portrait" data-detail="alice-vrm-miniature" data-reference="local-vrm-thumbnail" data-portrait="decorative-animated" data-motion-purpose="decorative-only">
    <g data-detail="ash-brown-twin-tails" fill="url(#alice-hair)" stroke="#554b48" stroke-width=".6">
      <path d="M63 47Q47 45 46 69l-3 59-4 13q10 2 20-5l9-61Z"/>
      <path d="M123 47q15-2 17 21l3 62 4 11q-12 3-23-5l-7-61Z"/>
      <path d="M58 66q-4 37-8 68m10-54-5 51m72-65q7 34 8 68m-10-52 5 49" fill="none" stroke="#ddc8b0" stroke-width=".4" opacity=".7"/>
      <path d="M52 62q-3 46-7 67m89-64q2 39 5 65" fill="none" stroke="#72665b" stroke-width=".5"/>
      <path d="M55 56q-3 6-3 12m80-12q3 6 3 12" stroke="#181c23" stroke-width="2"/>
    </g>
    <path d="M58 78Q48 49 71 40q22-13 43 1 21 7 19 38l-6 41H60Z" fill="url(#alice-hair)" stroke="#554b48" stroke-width=".65"/>
    <g data-detail="dark-techwear-bust">
      <path d="M82 107v14l-22 6-12 13 5 4h81l5-4-14-13-21-6v-14Z" fill="url(#alice-skin)" stroke="#806965" stroke-width=".55"/>
      <path d="m68 118 12 6 13 15 14-15 12-6 12 11 9 12-5 4H51l-5-4 10-13Z" fill="url(#alice-cloth)" stroke="#808993" stroke-width=".65"/>
      <path d="m63 122 13 8-8 5 16 9M123 122l-13 8 8 5-16 9" fill="#161b22" stroke="#646c76" stroke-width=".5"/>
      <path d="M79 116q14 7 28 0l-1 10-13 11-13-11Z" fill="url(#alice-cloth)" stroke="#555861" stroke-width=".55"/>
      <path d="M80 119q13 7 26 0M57 133l8 7m65-7-8 7" fill="none" stroke="#818691" stroke-width=".4"/>
      <path d="m86 133 7-3 7 3 2 10H84Z" fill="url(#dark-metal)" stroke="#919ba8" stroke-width=".6"/>
      <path d="m89 136 4-2 4 2v5h-8Z" fill="#10141c" stroke="#555e6c" stroke-width=".45"/>
      <path d="m60 130 13 9m53-9-13 9" stroke="#99a6b7" stroke-width="1.1"/>
      <path d="m62 130 2 4 3-2 2 4 3-2m52-4-2 4-3-2-2 4-3-2" fill="none" stroke="#151a21" stroke-width=".55"/>
    </g>
    <g data-detail="alice-face">
      <path d="M62 71q0-23 31-24 31 1 31 24l-2 22q-3 18-29 30-26-12-29-30Z" fill="url(#alice-skin)" stroke="#9b7e76" stroke-width=".6"/>
      <path d="M68 82q8-5 17-1m17 0q10-4 17 1" fill="none" stroke="#a9958e" stroke-width=".55"/>
      <g class="avatar-preview-eyes" data-detail="lavender-grey-eyes">
        ${[0,1].map(i=>`<g transform="${i?'translate(186 0) scale(-1 1)':'translate(0 0)'}">
          <path d="M67 88q8-7 19 1-2 11-10 10-7-1-9-11Z" fill="#fff3ed" stroke="#b79b96" stroke-width=".45"/>
          <ellipse cx="77.5" cy="91.3" rx="5.1" ry="7" fill="url(#alice-iris)" stroke="#68647b" stroke-width=".55"/>
          <ellipse cx="77.5" cy="89" rx="1.05" ry="2.35" fill="#41455c"/>
          <path d="M74 94q3.5 4 7 0" fill="none" stroke="#d7e5dd" stroke-width=".45"/>
          <ellipse cx="75" cy="87" rx="1.3" ry="1.7" fill="#fff" opacity=".94"/>
          <circle cx="80" cy="94" r=".7" fill="#e8eff2"/>
          <path d="M66 86q9-5 20 3-10-5-18 0Z" fill="#30313b"/>
          <path d="m69 87-3-3m6 2-2-3M70 97q6 5 13 0" fill="none" stroke="#63545a" stroke-width=".5"/>
        </g>`).join('')}
      </g>
      <path d="m93 99-1 5 2 1" fill="none" stroke="#c5a097" stroke-width=".45"/>
      <path d="M88 111q5 1.8 10 0" fill="none" stroke="#ad8283" stroke-width=".65" stroke-linecap="round"/>
      <path d="M90 112h6" stroke="#fff4ec" stroke-width=".4"/>
    </g>
    <g data-detail="layered-fringe-and-ahoge" fill="url(#alice-fringe)" stroke="#77685e" stroke-width=".5">
      <path d="M58 73q-2-35 34-35 35-1 37 35l-2 34-8-3 1-27-3 6-11-1-2-11-2 10-10-1-3-12-2 12-11 1-2-9-1 11-12 1-1-7 2 28-8 3Z"/>
      <path d="M92 39q-17-7-14-20 3 11 17 18-2-11 7-16-6 9-5 17"/>
      <path d="M86 42Q65 48 65 73m22-28Q77 58 79 75m13-31-1 17m7-16 4 18m1-21q16 11 17 31M60 84l1 16m65-17-2 17" fill="none" stroke="#e7d2b8" stroke-width=".45" opacity=".72"/>
      <path d="M83 43q-12 11-13 32m28-31 8 32m2-30q13 15 15 29" fill="none" stroke="#8e7c6b" stroke-width=".45"/>
      <path d="M65 61q13-7 23-5m11 0q13 0 20 8" fill="none" stroke="#f1dfc7" stroke-width="1" opacity=".4"/>
    </g>
  </g>
  <g data-detail="vrm-read-only-inspector">
    <path d="M154 50h13l5 5v78l-5 5h-13Z" fill="url(#dark-metal)" stroke="#a9b6c7" stroke-width=".65"/>
    <path d="M155 53v81m15-76v72" stroke="#617388" stroke-width=".3"/>
    ${[[54,32,'rig'],[90,18,'expressions'],[112,22,'springs']].map(([y,h,panel])=>`<g data-detail="recessed-inspector-panel" data-panel="${panel}">
      <path d="M158 ${y}h9l2 2v${h-4}l-2 2h-9l-2-2v-${h-4}Z" fill="#020811" stroke="#708299" stroke-width=".4"/>
      <path d="M159 ${y+1}h7m-9 2v${h-6}" fill="none" stroke="#c4d1df" stroke-width=".25" opacity=".65"/>
      <path d="M160 ${y+h-1}h5" stroke="${panel==='rig'?b:'#68768a'}" stroke-width=".4"/>
    </g>`).join('')}
    <g data-detail="humanoid-rig-inspection" fill="none" stroke="#b4c4d5" stroke-width=".55">
      <path d="m161 59 2-1 2 1v3l-2 2-2-2Z" fill="#192738"/>
      <path d="M163 64v11m-4-5 1-4 3-1 3 1 1 4m-7-3 1 6h4l1-6m-3 8-3 8m3-8 3 8m-6 0h-2m8 0h2"/>
      <path d="M161 68h4m-4 2h4" stroke="#71849a" stroke-width=".35"/>
      ${[[163,65],[160,67],[166,67],[163,75],[161,79],[165,79]].map(([x,y])=>`<g data-detail="rig-inspection-joint"><circle cx="${x}" cy="${y}" r=".8" fill="#061422" stroke="${b}" stroke-width=".35"/><circle cx="${x}" cy="${y}" r=".25" fill="#d7f3ff"/></g>`).join('')}
    </g>
    <g data-detail="read-only-expression-catalog" data-state="not-driven">
      <path d="M159 95q4-4 8 0v5q-1 4-4 5-3-1-4-5Z" fill="#18202d" stroke="#aab6c8" stroke-width=".5"/>
      <path d="M160 97q1-1 2 0m2 0q1-1 2 0m-5 5h4m-2-4v2" fill="none" stroke="#c3cbd6" stroke-width=".35"/>
      <g data-detail="expression-contour-guides" fill="none" stroke="#8e819e" stroke-width=".3"><path d="m159 100 2 1m6-1-2 1M158 94v8m10-8v8"/></g>
    </g>
    <g data-detail="spring-joint-chain" fill="#07101c" stroke="#a1b1c2" stroke-width=".5">
      <path d="m160 116 6 7-6 7" fill="none" stroke="#4c5e76"/>
      <path data-detail="spring-coil-windings" d="m161 117 2-1-1 3 3-1-1 3 2-1m-1 4 1 2-3-1 1 3-3-1" fill="none" stroke="#b4bed0" stroke-width=".4"/>
      ${[[160,116],[166,123],[160,130]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.35" fill="url(#metal)"/><circle cx="${x}" cy="${y}" r=".6" fill="#080d18" stroke="#c0afc9" stroke-width=".3"/>`).join('')}
    </g>
    ${fastener(163,88,b,.6)}${fastener(163,110,a,.6)}
  </g>
  <g data-detail="manual-gamepad-dock" data-control="manual-only">
    <path d="M74 140h38l5 5-2 7-7-4H78l-7 4-2-7Z" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width=".7"/>
    <g data-detail="gamepad-machined-controls">
      <path d="M74 141h9m21 0h8m-40 5 1 3 4-3m38 0-1 3-4-3" fill="none" stroke="#8498ae" stroke-width=".35"/>
      <path d="M75 143h2v-2h2v2h2v2h-2v2h-2v-2h-2Z" fill="#08121f" stroke="${b}" stroke-width=".35"/>
      ${[[109,142],[107,144],[111,144],[109,146]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r=".7" fill="#101b2a" stroke="${i%2?a:b}" stroke-width=".35"/>`).join('')}
      ${[87,100].map(x=>`<circle cx="${x}" cy="146" r="1.9" fill="url(#metal)" stroke="#9cabbf" stroke-width=".3"/><circle cx="${x}" cy="146" r="1.1" fill="#050a12" stroke="#6d8198" stroke-width=".3"/><path d="M${x-.65} 145.5h1.3" stroke="#94a3b8" stroke-width=".25"/>`).join('')}
      <path d="M90 141.5h7v2.5h-7Z" fill="#030912" stroke="#64748b" stroke-width=".3"/><path d="M92 142.7h3" stroke="${b}" stroke-width=".3"/>
      <path d="M91 148h5" stroke="#a0aebf" stroke-width=".3"/>
    </g>
  </g>
  <g data-detail="connection-boundary-rail">
    <path d="M120 144h32l2 2v5l-2 2h-32l-2-2v-5Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".45"/>
    <path d="M121 145h30m-30 7h30" stroke="#b7c5d5" stroke-width=".25" opacity=".6"/>
    ${boundaries.map((boundary,i)=>`<g data-detail="avatar-boundary-port" data-boundary="${boundary}" data-connected="${i===0}"><path d="M${121+i*8} 146h6v5h-6Z" fill="#030810" stroke="#41516a" stroke-width=".25"/><circle cx="${124+i*8}" cy="148.5" r="1.7" fill="${i===0?b:'#111827'}" stroke="${i===0?'#e2e8f0':'#8291a7'}" stroke-width=".4"/>${i?`<path d="m${123+i*8} 149.5 2-2" stroke="#a0aec0" stroke-width=".4"/>`:`<circle cx="124" cy="148.5" r=".65" fill="#e0faff"/>`}</g>`).join('')}
  </g>
  <g data-detail="local-viewer-indicator" data-motion-purpose="decorative-only"><path class="pulse" d="M151 53v29" stroke="${b}" stroke-width=".75"/><path d="M151 88v22m0 6v13" stroke="${a}" stroke-width=".45" opacity=".55"/></g>`;
}
