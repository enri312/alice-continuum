import { plate, line, pin, dial, bolt, conduit } from "../shared/instrument.mjs";

export default function avatar(accent, secondary) {
  return `<defs>
    <linearGradient id="alice-hair" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#665e59"/><stop offset=".28" stop-color="#b3a594"/><stop offset=".48" stop-color="#d8c7b2"/><stop offset=".65" stop-color="#9c9185"/><stop offset="1" stop-color="#635e59"/></linearGradient>
    <linearGradient id="alice-fringe" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#918579"/><stop offset=".38" stop-color="#baab98"/><stop offset=".54" stop-color="#e0ceb8"/><stop offset=".65" stop-color="#bdad99"/><stop offset="1" stop-color="#958b80"/></linearGradient>
    <radialGradient id="alice-skin" cx=".48" cy=".36" r=".75"><stop stop-color="#fff0e4"/><stop offset=".65" stop-color="#f2dbce"/><stop offset="1" stop-color="#c89f96"/></radialGradient>
    <linearGradient id="alice-iris" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#5e5c80"/><stop offset=".48" stop-color="#929cb1"/><stop offset="1" stop-color="#c0d8d0"/></linearGradient>
    <linearGradient id="alice-cloth" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#48505a"/><stop offset=".3" stop-color="#24282e"/><stop offset=".7" stop-color="#101419"/><stop offset="1" stop-color="#3b424c"/></linearGradient>
  </defs>
  <g data-component="manual-viewer">
    ${plate("M13 67l11-8 16-1 10 6 22-6 15 5v13L54 91l-39-10Z","dark-metal")}
    ${line("M19 77l30 8 27-11",accent,1.4)}
    ${conduit("M14 67V31l8-7h7",secondary)}
    ${dial(16,43,5)}${bolt(83,69)}
  </g>
  <g data-part="vrm-turntable">
    ${plate("M18 68 50 56 83 66V76L50 88 18 79Z","dark-metal")}
    ${plate("M17 68 49 56 83 66 50 79Z","metal")}
    ${line("M24 75l25 8 24-8",accent,1.5)}
    ${line("M20 60V34L34 21M67 20l12 11v24","#8199b1",1.5)}
    <g transform="translate(-4 -10) scale(.58)">
      <g class="avatar-preview-portrait" data-detail="alice-vrm-miniature" data-reference="local-vrm-thumbnail" data-portrait="static" data-motion-purpose="decorative-only">
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
  </g></g>
    ${pin(49,82,1.5,secondary)}
  <g data-component="turntable-controls">
    ${plate("M56 76l14-6 11 2v6l-15 7-10-3Z","metal")}
    ${line("M61 78l5-2m-3-1v4","#223950",1.5)}${pin(74,75,1.3,accent)}
    ${line("M19 70l13 4m-12-1 7 2","#99acbd",1)}
  </g>
  </g>`;
}
