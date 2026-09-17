// Temporal frontend events: selection, elapsed time and module provenance.
export function activityTimelineScene(a, b, { plinth, fastener, socket }) {
  const colors = ['#94a3b8', '#22d3ee', '#a78bfa', '#fbbf24', '#34d399', '#fb7185'];
  const modules = ['system', 'perception', 'memory', 'workspace', 'output', 'security'];
  const lanes = [65, 83, 101].map((y, lane) => `<g data-detail="temporal-event-lane">
    <path d="M43 ${y}h76" stroke="#334155" stroke-width=".65"/>
    <path d="M43 ${y+3}h76" stroke="#0f172a" stroke-width=".4"/>
    ${[51+lane*4,74+lane*3,105-lane*5].map((x,i)=>`<g data-detail="timestamp-event"><path d="M${x} ${y+4}v4" stroke="#64748b" stroke-width=".4"/><path d="m${x} ${y-4} 4 2v4l-4 2-4-2v-4Z" fill="#020812" stroke="${colors[(lane+i)%6]}" stroke-width=".65"/><circle cx="${x}" cy="${y}" r="1.2" fill="${colors[(lane+i)%6]}"/></g>`).join('')}
  </g>`).join('');
  return `${plinth(a,b,152)}
  <g data-detail="temporal-event-console" filter="url(#shadow)">
    <path d="M29 145V51l15-15h112l15 15v94" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width="1.2"/>
    <path d="M37 136V56l11-11h104l11 11v80" fill="#030914" stroke="#475569" stroke-width=".65"/>
    <path d="M49 41h101M40 132h120" stroke="#94a3b8" stroke-width=".4"/>
    ${fastener(36,49,a,1)}${fastener(164,49,b,1)}${fastener(36,140,b,.8)}${fastener(164,140,a,.8)}
  </g>
  <g data-detail="local-event-clock" transform="translate(53 37)">
    <circle r="14" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width=".75"/><circle r="10.8" fill="#020812" stroke="${b}" stroke-width=".6"/>
    ${Array.from({length:12},(_,i)=>`<path d="M0-9v${i%3?1.1:2}" transform="rotate(${i*30})" stroke="#94a3b8" stroke-width=".4"/>`).join('')}
    <path d="M0-6v6l4 3" fill="none" stroke="#e2e8f0" stroke-width=".8"/><circle r="1.4" fill="${a}"/>
  </g>
  <g data-detail="temporal-event-window"><path d="M39 54h81v57H39Z" fill="#040c15" stroke="#64748b" stroke-width=".5"/>${lanes}</g>
  <g data-detail="event-playhead"><path d="M95 54v56" stroke="${b}" stroke-width=".55" stroke-dasharray="2 2"/>
    <g data-detail="playhead-index-ring"><circle cx="95" cy="48" r="4" fill="#020812" stroke="${b}" stroke-width=".6"/><circle class="pulse" cx="95" cy="48" r="1.5" fill="${a}"/></g>
    <circle cx="95" cy="101" r="7" fill="#020812" stroke="#f8fafc" stroke-width=".65"/><path d="m95 97 4 2v4l-4 2-4-2v-4Z" fill="url(#glass)" stroke="${a}" stroke-width=".6"/>
  </g>
  <g data-detail="selection-inspection-link"><path d="M102 101h22v-9h5" fill="none" stroke="${b}" stroke-width=".6"/><circle cx="124" cy="101" r="1.2" fill="${b}"/></g>
  <g data-detail="selected-event-inspector"><path d="M132 58h20l7 7v53l-7 7h-20l-5-5V63Z" fill="url(#dark-metal)" stroke="${a}" stroke-width=".75"/>
    <path d="M133 65h18v15h-18Z" fill="#020812" stroke="#64748b" stroke-width=".4"/>
    <path d="m142 68 5 3v5l-5 3-5-3v-5Z" fill="url(#glass)" stroke="${b}" stroke-width=".6"/>
    ${['timestamp','module','node','payload'].map((field,i)=>`<g data-field="${field}"><circle cx="133" cy="${86+i*8}" r=".8" fill="${i%2?a:b}"/><path d="M137 ${84+i*8}h13m-13 3h${i%2?9:11}" stroke="#94a3b8" stroke-width=".4"/></g>`).join('')}
    <path d="M133 120h16" stroke="#64748b" stroke-width=".4"/>
  </g>
  <g data-detail="elapsed-time-ruler"><path d="M42 117h77" stroke="#94a3b8" stroke-width=".5"/>${Array.from({length:16},(_,i)=>`<path d="M${43+i*5} 117v${i%5?2:4}" stroke="#94a3b8" stroke-width=".35"/>`).join('')}</g>
  <g data-detail="temporal-retention-buffer"><path d="M42 128h76v9H42Z" fill="#020812" stroke="#475569" stroke-width=".45"/>${Array.from({length:24},(_,i)=>`<path d="M${45+i*3} 130v5" stroke="${i>18?a:'#64748b'}" stroke-width=".65" opacity="${i>18?.8:.4}"/>`).join('')}</g>
  <g data-detail="event-module-legend">${modules.map((module,i)=>`<g data-module="${module}" transform="translate(${48+i*21} 148)"><path d="M-7-5H7v10H-7Z" fill="#020812" stroke="#475569" stroke-width=".45"/><circle r="2" fill="none" stroke="${colors[i]}" stroke-width=".65"/><circle r=".65" fill="${colors[i]}"/></g>`).join('')}</g>
  <g data-detail="event-ingress"><path d="M23 83h14" stroke="#64748b" stroke-width=".6"/>${socket(21,83,a,b,4.5)}</g>
  <g data-detail="event-severity-stack">${['#94a3b8','#fbbf24','#fb7185'].map((color,i)=>`<circle cx="177" cy="${78+i*12}" r="2.4" fill="#020812" stroke="${color}" stroke-width=".6"/>`).join('')}<path d="M171 72h10v37h-10" fill="none" stroke="#475569" stroke-width=".5"/></g>`;
}
