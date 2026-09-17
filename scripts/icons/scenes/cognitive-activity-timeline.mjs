// Temporary frontend events: chronology, selection and provenance, not durable R3 audit.
export function temporalInspectionScene(a,b,{plinth,fastener}) {
  const colors=['#94a3b8','#22d3ee','#a78bfa','#fbbf24','#34d399','#fb7185'];
  const modules=['system','perception','memory','workspace','output','security'];
  const glyphs=['M-3-3h6v6h-6Zm1 2h4m-4 2h3','M-4 0Q0-5 4 0 0 5-4 0Zm4-1v2','m0-3 4 2-4 2-4-2Zm-4 4 4 2 4-2','M-3-3h6v6h-6Zm-2 3h2m6 0h2','M-4-3h8v5H0l-2 2V2h-2Z','M0-4 4-2v3L0 4-4 1v-3Z'];
  return `<style>[data-icon="activity"] .alive{animation:none}.timeline-optical-index{animation:timeline-optical-index 4.2s ease-in-out infinite}@keyframes timeline-optical-index{0%,100%{transform:translateX(0);opacity:.35}50%{transform:translateX(52px);opacity:1}}@media(prefers-reduced-motion:reduce){.timeline-optical-index{animation:none}}</style>
  ${plinth(a,b,160)}
  <g data-detail="temporal-event-console" filter="url(#shadow)">
    <path d="M24 145V55l19-20h114l19 20v90l-11 10H35Z" fill="url(#dark-metal)" stroke="#bdcbdc" stroke-width="1.1"/>
    <path d="M32 137V60l15-16h105l16 16v77Z" fill="#040b16" stroke="#4c617b" stroke-width=".55"/>
    <path d="M45 39h110M28 67v61m144-61v61M39 151h121" stroke="#a7b6ca" stroke-width=".35"/>
    ${fastener(34,52,a,1.2)}${fastener(166,52,b,1.2)}${fastener(34,145,b,1.1)}${fastener(166,145,a,1.1)}
  </g>
  <g data-detail="local-event-clock" data-time="symbolic">
    <path d="M48 36v-5h13v5m-21 10-3-3m35 3 3-3" fill="none" stroke="#9badc5" stroke-width="1"/>
    <circle cx="55" cy="56" r="22" fill="url(#metal)" stroke="#b6cadb" stroke-width=".7"/><circle cx="55" cy="56" r="18.5" fill="#071222" stroke="${b}" stroke-width=".6"/><circle cx="55" cy="56" r="14.5" fill="url(#glass)" stroke="#59748f" stroke-width=".35"/>
    ${Array.from({length:24},(_,i)=>`<path d="M55 39v${i%6?1.3:2.8}" transform="rotate(${i*15} 55 56)" stroke="#bac9d9" stroke-width="${i%6?.3:.5}"/>`).join('')}
    <path d="M55 45v11l7 5" fill="none" stroke="#d3e2ed" stroke-width=".85"/><circle cx="55" cy="56" r="2.2" fill="url(#metal)" stroke="${a}" stroke-width=".4"/><circle cx="55" cy="56" r=".8" fill="#e2ebf3"/><path d="M49 66h12" stroke="#8298b2" stroke-width=".4"/>
  </g>
  <g data-detail="local-event-filter-deck"><path d="M86 45h70l6 6v11H86Z" fill="url(#dark-metal)" stroke="#8da2bc" stroke-width=".55"/><path d="M92 49h11l-4 5v4l-3-1v-3Zm18 0h43v9h-43Z" fill="#07111f" stroke="#9cacc1" stroke-width=".4"/><circle cx="116" cy="53" r="2" fill="none" stroke="#b9c8d9" stroke-width=".45"/><path d="m117.5 54.5 2 2m5-4h22m-22 3h15" stroke="#879fb8" stroke-width=".35"/></g>
  <g data-detail="temporal-retention-buffer" data-retention="temporary" data-visible-limit="24"><path d="M86 65h75v10H86Z" fill="#081222" stroke="#68829f" stroke-width=".45"/>${Array.from({length:24},(_,i)=>`<g data-detail="retention-slot"><path d="M${90+i*2.8} 68v4" stroke="#8194ae" stroke-width=".5"/></g>`).join('')}<path d="M88 67v6m71-6v6" stroke="#c2cedb" stroke-width=".4"/></g>
  <g data-detail="temporal-event-window" data-representation="illustrative-not-live"><path d="M34 79h84l8 7v47H34Z" fill="url(#dark-metal)" stroke="#93a8bf" stroke-width=".65"/><path d="M39 83h80v45H39Z" fill="#050d1a" stroke="#506980" stroke-width=".4"/>
    ${[89,105,121].map((y,lane)=>`<g data-detail="temporal-event-lane"><path d="M42 ${y}h75m-75 3h75" stroke="#3f5571" stroke-width=".45"/>${[49+lane*3,75+lane*4,109].map((x,i)=>`<g data-detail="timestamp-event"><path d="M${x-5} ${y-5}h9l3 3v6h-12Z" fill="#102238" stroke="${colors[(lane+i)%6]}" stroke-width=".45"/><path d="M${x-3} ${y-2}h5m-5 3h3" stroke="#afc2d7" stroke-width=".35"/><path d="M${x} ${y+4}v3" stroke="#8299b1" stroke-width=".4"/></g>`).join('')}</g>`).join('')}
  </g>
  <g data-detail="event-playhead" data-selection="illustrative"><path d="M79 80v49" stroke="#b5c9db" stroke-width=".5" stroke-dasharray="2 2"/><g data-detail="playhead-index-ring"><circle cx="79" cy="79" r="3" fill="#06101f" stroke="${a}" stroke-width=".5"/><circle cx="79" cy="79" r="1.1" fill="#c5dcf0"/></g><path d="M71 98h15l4 4v9H71Z" fill="url(#metal)" stroke="#dce5ef" stroke-width=".65"/><path d="M74 101h12v7H74Z" fill="#0a1b2e" stroke="${a}" stroke-width=".45"/><path d="M77 103h6m-6 3h4" stroke="#d3dfec" stroke-width=".4"/></g>
  <g data-detail="selection-inspection-link"><path d="M90 105h13v-9h29" fill="none" stroke="#050914" stroke-width="2.8"/><path d="M90 105h13v-9h29" fill="none" stroke="#99bdd5" stroke-width=".7"/><path d="M110 94h5v4h-5Z" fill="#122740" stroke="#b2c6db" stroke-width=".35"/></g>
  <g data-detail="selected-event-inspector"><path d="M137 81h24l10 10v44h-34l-5-5V86Z" fill="url(#dark-metal)" stroke="#bccdde" stroke-width=".7"/><path d="M161 81v10h10M137 87h18" fill="none" stroke="${a}" stroke-width=".4"/>
    ${['timestamp','module','node','payload'].map((field,i)=>`<g data-field="${field}" data-detail="event-inspector-field"><path d="M137 ${94+i*8}h28v6h-28Z" fill="#06111f" stroke="#526e89" stroke-width=".3"/><path d="M140 ${96+i*8}h3v2h-3Zm6 0h15m-15 2h10" fill="none" stroke="#a6bbd2" stroke-width=".3"/></g>`).join('')}
    <g data-detail="event-severity-stack">${['#94a3b8','#fbbf24','#fb7185'].map((color,i)=>`<path d="M${140+i*8} 129h5v3h-5Z" fill="#091323" stroke="${color}" stroke-width=".35"/>`).join('')}</g>
  </g>
  <g data-detail="elapsed-time-ruler"><path d="M36 137h91" stroke="#718ba4" stroke-width=".45"/>${Array.from({length:19},(_,i)=>`<path d="M${37+i*5} 134v${i%3?3:5}" stroke="#a0b4c9" stroke-width=".3"/>`).join('')}</g>
  <g data-detail="event-module-legend">${modules.map((module,i)=>`<g data-module="${module}" transform="translate(${46+i*22} 147)"><path d="M-8-5H8v10H-8Z" fill="url(#dark-metal)" stroke="#788fa8" stroke-width=".4"/><path d="${glyphs[i]}" fill="none" stroke="${colors[i]}" stroke-width=".45"/><path d="M-6 4h12" stroke="#4c627d" stroke-width=".3"/></g>`).join('')}</g>
  <g data-detail="event-ingress"><path d="M27 87h7" stroke="#9ab0c5" stroke-width=".65"/><path d="M25 83h4v8h-4Z" fill="url(#metal)" stroke="#8296af" stroke-width=".35"/></g>
  <g data-detail="timeline-bezel-illumination" data-motion-purpose="decorative-only"><path class="timeline-optical-index" d="M88 42h7" stroke="${b}" stroke-width=".7" filter="url(#soft-glow)"/></g>`;
}
