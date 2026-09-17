// Symbolic observatory, not live data: circular memories, diamond processes,
// violet owner-confirmed associations. The projection is not brain anatomy.
export function volumeObservatoryScene(a, b, { plinth, fastener, socket }) {
  const layers = [['episodic','#22d3ee'],['semantic','#a78bfa'],['procedural','#fbbf24'],['preference','#f472b6'],['self','#34d399'],['unclassified','#64748b']];
  const memories = [[57,82,2.8,0],[75,71,2.3,1],[94,63,1.9,5],[116,78,2.4,2],[67,97,3.5,0],[89,86,3,1],[109,99,3.1,4],[54,111,2.2,3],[82,117,3,4],[104,120,1.8,5],[124,108,2.2,0],[91,103,2.1,3]];
  const associations = [[0,4],[4,8],[5,6],[6,10]];
  return `${plinth(a,b,160)}
  <g data-detail="volume-orientation-cradle" filter="url(#shadow)">
    <path d="M30 140V64l14-19 65-18 38 24v78l-17 18H43Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width="1"/>
    <path d="M38 132V68l12-16 58-16 31 20v71l-13 11H47Z" fill="#030b14" stroke="#334155" stroke-width=".65"/>
    <path d="M36 68v48M52 48l50-14m38 26v63" stroke="#cbd5e1" stroke-width=".4"/>
    ${fastener(39,58,a,1)}${fastener(139,53,b,1)}${fastener(39,138,b,.85)}${fastener(136,132,a,.85)}
  </g>
  <g data-detail="stereoscopic-volume-chamber">
    <path d="m43 65 57-16 35 20v49l-56 18-36-22Z" fill="url(#glass)" fill-opacity=".45" stroke="#475569" stroke-width=".55"/>
    <path d="m43 65 35 20 57-16M78 85v51" fill="none" stroke="#64748b" stroke-width=".35" opacity=".45"/>
    <path d="M100 49v46l35 23m-35-23-57 19" fill="none" stroke="#334155" stroke-width=".35" stroke-dasharray="2 3"/>
    <path d="M46 69v9m0 28v6l10 6m65-47 10-3m-8 55 9-3v-8" fill="none" stroke="${a}" stroke-width=".65"/>
  </g>
  <g data-detail="confirmed-memory-associations" data-authority="owner-confirmed">
    ${associations.map(([i,j])=>`<path data-detail="confirmed-association-edge" d="M${memories[i][0]} ${memories[i][1]}L${memories[j][0]} ${memories[j][1]}" stroke="${b}" stroke-width=".7" fill="none"/>`).join('')}
  </g>
  <g data-detail="persistent-memory-anchors">
    ${memories.map(([x,y,r,layer],i)=>`<g data-anchor-index="${i}" data-node-kind="memory"><circle cx="${x}" cy="${y}" r="${r+1.4}" fill="#030914" stroke="#475569" stroke-width=".3"/><circle cx="${x}" cy="${y}" r="${r}" fill="${layers[layer][1]}" stroke="#e2e8f0" stroke-width=".4"/><circle cx="${x-r*.25}" cy="${y-r*.3}" r=".5" fill="#fff" opacity=".8"/></g>`).join('')}
  </g>
  <g data-detail="r3-temporal-pulse-cluster" data-persistence="transient">
    ${[[65,62],[119,91],[74,108]].map(([x,y],i)=>`<g data-node-kind="process"><path class="${i===1?'pulse':''}" d="m${x} ${y-3.8} 3.8 3.8-3.8 3.8-3.8-3.8Z" fill="#020812" stroke="${i===1?'#fbbf24':a}" stroke-width=".65"/><path d="M${x-1} ${y}h2" stroke="#cbd5e1" stroke-width=".4"/></g>`).join('')}
  </g>
  <g data-detail="selected-memory-focus"><circle cx="109" cy="99" r="6.6" fill="none" stroke="#cbd5e1" stroke-width=".5"/><path d="M103 93h3m9 0h-3m-9 12h3m9 0h-3" stroke="${a}" stroke-width=".45"/></g>
  <g data-detail="volume-provenance-inspector">
    <path d="M151 65h18l9 9v58l-8 8h-19l-5-5V70Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".65"/>
    <path d="M153 72h15l5 5v13h-20Z" fill="#020812" stroke="${a}" stroke-width=".4"/>
    <circle cx="162" cy="81" r="3" fill="none" stroke="${a}" stroke-width=".55"/><path d="M157 88h10" stroke="#64748b" stroke-width=".35"/>
    ${['source','version','lifecycle','accessibility'].map((field,i)=>`<g data-field="${field}"><circle cx="153" cy="${97+i*8}" r=".7" fill="${i%2?b:a}"/><path d="M157 ${95+i*8}h13m-13 3h9" stroke="#94a3b8" stroke-width=".35"/></g>`).join('')}
    <path d="M153 131h18" stroke="#64748b" stroke-width=".4"/>
    <g data-detail="volume-inspector-retainers" fill="none" stroke="#a1b7cc" stroke-width=".28"><path d="M150 93v33m23-33v32m-2-28h3m-3 8h3m-3 8h3M156 133h7"/></g>
    ${fastener(173,73,b,.6)}${fastener(173,131,a,.6)}
  </g>
  <g data-detail="selected-node-inspection-link"><path d="M116 99h27v-5h4" fill="none" stroke="#94a3b8" stroke-width=".4" stroke-dasharray="2 2"/></g>
  <g data-detail="memory-layer-legend">${layers.map(([layer,color],i)=>`<g data-layer="${layer}" transform="translate(${53+i*13} 141)"><path d="M-5-4H5v8H-5Z" fill="#020812" stroke="#475569" stroke-width=".35"/><circle r="1.5" fill="${color}" stroke="#94a3b8" stroke-width=".25"/></g>`).join('')}</g>
  <g data-detail="inactive-affect-reserve" data-state="no-live-affect-claim"><path d="M145 145h33v10h-33Z" fill="#020812" stroke="#64748b" stroke-width=".45"/>${Array.from({length:10},(_,i)=>`<circle cx="${149+i%5*5.8}" cy="${148+Math.floor(i/5)*4}" r=".75" fill="#475569"/>`).join('')}</g>
  <g data-detail="volume-navigation-deck"><path d="M49 149h82l5 5-5 6H49l-5-6Z" fill="url(#dark-metal)" stroke="#64748b" stroke-width=".55"/>
    <g data-control="rotate"><path d="M60 151a3 3 0 1 0 3 3m0-3v3h-3" fill="none" stroke="${a}" stroke-width=".5"/></g>
    <g data-control="pan"><path d="M73 154h7m-3.5-3.5v7" stroke="#94a3b8" stroke-width=".5"/></g>
    <g data-control="zoom"><circle cx="97" cy="153" r="2.5" fill="none" stroke="#94a3b8" stroke-width=".5"/><path d="m99 155 3 3m-7-5h4m-2-2v4" stroke="#94a3b8" stroke-width=".4"/></g>
    <g data-control="reset"><path d="m116 151 4 3v4h-8v-4Z" fill="none" stroke="${b}" stroke-width=".5"/></g>
  </g>
  <g data-detail="neural-volume-interface">${socket(22,112,a,b,4.2)}<path d="M28 112h2" stroke="#64748b" stroke-width=".5"/></g>`;
}
