// State console: two session faders, six locked controls and recovered evidence.
export function stateObservatoryScene(a, b, { plinth, fastener, socket }) {
  const metrics = ['curiosity','social','frustration','inhibition','trust','fatigue','surprise','memory'];
  const locked = ['autonomy','inhibition','stability','memory','anticipation','speed'];
  const fader = (name,y,thumb) => `<g data-control="${name}" data-state="adjustable-session">
    <path d="M45 ${y-7}h110l5 5v11l-5 5H45l-5-5v-11Z" fill="url(#dark-metal)" stroke="${a}" stroke-width=".65"/>
    <path d="M51 ${y+2}h97" stroke="#152c3a" stroke-width="4.8" stroke-linecap="round"/>
    <path d="M51 ${y+2}h${thumb-51}" stroke="${a}" stroke-width="2.1" stroke-linecap="round"/>
    <path d="M${thumb-4} ${y-4}h8v12h-8Z" fill="#baffea" stroke="#e2fff5" stroke-width=".5"/>
    <path d="M${thumb-2} ${y-1}h4m-4 3h4m-4 3h4" stroke="#318270" stroke-width=".45"/>
    <path d="M53 ${y-5}h13m66 0h13" stroke="#94a3b8" stroke-width=".6"/>
  </g>`;
  return `${plinth(a,b,157)}
  <g data-detail="session-state-console" filter="url(#shadow)">
    <path d="M23 142V51l20-17h114l20 17v91l-17 17H40Z" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width="1.25"/>
    <path d="M32 139V57l16-14h104l16 14v82l-12 11H44Z" fill="#030a13" stroke="#526779" stroke-width=".65"/>
    <path d="M49 38h102M27 69v25m146-25v25M47 147h106" stroke="#94a3b8" stroke-width=".5"/>
    ${fastener(34,53,a,1)}${fastener(166,53,b,1)}${fastener(35,144,b,.85)}${fastener(165,144,a,.85)}
  </g>
  <g data-detail="selected-state-inspector">
    <path d="M43 52h114l5 5v39H38V57Z" fill="url(#dark-metal)" stroke="#64748b" stroke-width=".65"/>
    <path d="M43 57h66v32H43Z" fill="#020a11" stroke="${a}" stroke-width=".65"/>
    <path d="M47 65h58m-58 8h58m-58 8h58" stroke="#193040" stroke-width=".4"/>
    <path d="M52 60v26m13-26v26m13-26v26m13-26v26m11-26v26" stroke="#193040" stroke-width=".4"/>
    <path d="m47 78 9-3 7 4 8-13 7 12 7-6 9 3 10-12" fill="none" stroke="${a}" stroke-width="1.2"/>
    <circle cx="104" cy="63" r="1.8" fill="#c9fff0"/>
    <g data-detail="technical-signal-bank" data-evidence="heuristic">
      ${metrics.map((metric,i)=>{const x=117+(i%4)*10,y=59+Math.floor(i/4)*15;return `<g data-metric="${metric}" data-availability="ready"><path d="M${x} ${y}h6v10h-6Z" fill="#06131d" stroke="#536b7f" stroke-width=".4"/><path d="M${x+2} ${y+7}v-${3+i%4}" stroke="${i%3===0?b:a}" stroke-width="1.4"/></g>`;}).join('')}
    </g>
  </g>
  <g data-detail="retrieved-memory-cartridge">
    <path d="M42 93h116l4 4-4 9H42l-4-9Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".65"/>
    <path d="M47 97h12v5H47Z" fill="none" stroke="${a}" stroke-width=".5"/>
    <path d="M65 97h66m-66 4h47" stroke="#b5c8d6" stroke-width=".65"/>
    <path d="M140 97h12v5h-12Z" fill="#08121e" stroke="${b}" stroke-width=".5"/>
    <path d="M143 99h6" stroke="#b5c8d6" stroke-width=".7"/>
  </g>
  <g data-detail="session-behavior-control-deck" data-control-count="8" data-editable-count="2">
    ${fader('creativity',116,83)}${fader('empathy',136,123)}
    <g data-detail="permission-locked-control-bank">
      ${locked.map((name,i)=>{const x=45+i*18;return `<g data-control="${name}" data-state="locked"><path d="M${x} 153h11v8h-11Z" fill="url(#dark-metal)" stroke="#718291" stroke-width=".4"/><path d="M${x+4} 153v-2a1.5 1.5 0 0 1 3 0v2" fill="none" stroke="${b}" stroke-width=".65"/><circle cx="${x+5.5}" cy="157" r=".8" fill="${b}"/></g>`;}).join('')}
    </g>
    <g data-detail="read-only-interlock"><path d="M164 119h8v12h-8Zm1-1v-2a3 3 0 0 1 6 0v2" fill="#030a13" stroke="${b}" stroke-width=".65"/><circle cx="168" cy="124" r="1" fill="#cbd5e1"/></g>
  </g>
  <g data-detail="state-observation-port">${socket(20,98,a,b,4)}<path d="M28 98h8" stroke="#94a3b8" stroke-width=".55"/></g>`;
}
