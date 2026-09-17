// Cognitive planning remains unimplemented. The independent R7 owner dock supports
// reviewed reminders, durable reservations and separately confirmed local delivery.
export function actionPlanningScene(a, b, { plinth, fastener }) {
  const metrics = [
    ['intention','M0-3a3 3 0 1 0 0 6 3 3 0 1 0 0-6m0-1v2m0 4v2m-4-4h2m4 0h2'],
    ['utility','M0-4v7m-3 0h6M-4-2h8m-7 0-2 4h4l-2-4m6 0-2 4h4l-2-4'],
    ['risk','M0-4 4-2v3L0 4-4 1v-3Zm0 2v3m0 1v1'],
    ['novelty','M0-4 1-1 4 0 1 1 0 4-1 1-4 0-1-1Z'],
  ];
  const stages = [
    ['candidate','M-2-2h3v3h-3Zm2 0h2v4H0'],
    ['intent','M0-2a2 2 0 1 0 0 4 2 2 0 1 0 0-4m0 1v2m-1-1h2'],
    ['safety','M0-2 2 0v2L0 3-2 2V0Z'],
    ['arbiter','M-2-2 0 0 2-2M0 0v3'],
  ];
  return `<style>
    [data-icon="planner"] .alive{animation:none}
    .planner-bezel-reflection{animation:planner-bezel-reflection 4.5s ease-in-out infinite}
    @keyframes planner-bezel-reflection{0%,100%{transform:translateY(0);opacity:.25}50%{transform:translateY(43px);opacity:.95}}
    @media(prefers-reduced-motion:reduce){.planner-bezel-reflection{animation:none}}
  </style><defs>
    <linearGradient id="planning-board-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b3c5d4"/><stop offset=".18" stop-color="#4c637b"/><stop offset=".45" stop-color="#16243a"/><stop offset=".75" stop-color="#61748c"/><stop offset="1" stop-color="#18273d"/></linearGradient>
    <linearGradient id="planning-board-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#16354c"/><stop offset=".42" stop-color="#0b1728"/><stop offset="1" stop-color="#060b15"/></linearGradient>
  </defs>
  ${plinth(a,b,160)}
  <g data-detail="empty-planning-bench" filter="url(#shadow)">
    <path d="M24 144V53l18-19h116l18 19v91l-11 11H35Z" fill="url(#dark-metal)" stroke="#bacbdb" stroke-width="1.1"/>
    <path d="M32 135V58l14-15h108l14 15v77Z" fill="#040b16" stroke="#4e627c" stroke-width=".55"/>
    <path d="M43 38h112M28 65v66m144-66v66M40 151h120" stroke="#8ea4be" stroke-width=".35"/>
    ${fastener(34,49,a,1.3)}${fastener(166,49,b,1.3)}${fastener(33,145,b,1.2)}${fastener(167,145,a,1.2)}
  </g>
  <g data-detail="governed-arbitration-chamber" data-state="empty">
    <path d="M70 43h48l15 14v75l-8 8H70l-8-8V51Z" fill="url(#planning-board-metal)" stroke="#b8cadb" stroke-width=".8"/>
    <path d="M68 75h58v57H68Z" fill="url(#planning-board-glass)" stroke="#8297b1" stroke-width=".45"/>
    <path d="M119 46v11h11M66 78v51M70 136h53" fill="none" stroke="#b2c6d6" stroke-width=".35"/>
    <path d="M75 46h32M72 134h14m25 0h11" stroke="${a}" stroke-width=".4" opacity=".65"/>
    ${fastener(67,52,a,.9)}${fastener(129,132,b,.9)}
    <g data-detail="board-corner-retainers" fill="#102135" stroke="#9bacc3" stroke-width=".35"><path d="M68 75h7v3h-4v5h-3Zm51 0h7v8h-3v-5h-4ZM68 124h3v5h4v3h-7Zm55 0h3v8h-7v-3h4Z"/></g>
  </g>
  <g data-detail="planner-input-checkpoint" data-state="not-evaluated"><path d="M28 55h28l4 4v9H28Z" fill="url(#dark-metal)" stroke="#99adc5" stroke-width=".5"/><path d="M33 58h16v5h-7l-3 2v-2h-6Zm20 1v5m4-3h5" fill="none" stroke="#99bfd3" stroke-width=".4"/></g>
  <g data-detail="sealed-candidate-generator" data-state="not-implemented">
    <path d="M74 50h38l6 6v14H74Z" fill="#081321" stroke="#8fa5bf" stroke-width=".5"/>
    <g data-detail="empty-candidate-queue" data-count="0">${[0,1,2].map(i=>`<g data-detail="empty-candidate-slot"><path d="M${78+i*11} 57h8v9h-8Z" fill="#040a13" stroke="#63788e" stroke-width=".35" stroke-dasharray="1.5 1"/><path d="M${80+i*11} 61h4m-5 6h6" stroke="#61748c" stroke-width=".3"/></g>`).join('')}</g>
    <path d="M77 53h20m-20 16h34" stroke="#839bb2" stroke-width=".3"/>
    <path d="M105 51h7v5h-7Zm1.5 0v-2a2 2 0 0 1 4 0v2" fill="#111a27" stroke="#c6a172" stroke-width=".45"/>
  </g>
  <g data-detail="uncalculated-metric-bank">
    <path d="M28 73h28l4 5v57H28Z" fill="url(#dark-metal)" stroke="#91a6c0" stroke-width=".55"/>
    ${metrics.map(([metric,glyph],i)=>{const y=77+i*14;return `<g data-detail="uncalculated-metric" data-metric="${metric}" data-state="uncalculated"><path d="M31 ${y}h23v11H31Z" fill="#050c16" stroke="#627b97" stroke-width=".35"/><path d="${glyph}" transform="translate(37 ${y+5.5}) scale(.75)" fill="none" stroke="#a5b8ce" stroke-width=".5" stroke-linejoin="round"/><path d="M44 ${y+3}h7v5h-7Z" fill="#081424" stroke="#576e89" stroke-width=".3"/><path d="M46 ${y+5.5}h3" stroke="#8295ad" stroke-width=".4"/><path d="M33 ${y+10}h19" stroke="#31465e" stroke-width=".25"/></g>`;}).join('')}
  </g>
  <g data-detail="dormant-decision-trace" data-state="no-evidence">
    <path d="M87 83v39" stroke="#576b84" stroke-width=".45" stroke-dasharray="1.5 2"/>
    ${stages.map(([stage,glyph],i)=>{const y=82+i*13;return `<g data-detail="future-planner-stage" data-stage="${stage}" data-state="reserved"><path d="M77 ${y-4}h20l4 4-4 4H77Z" fill="#091625" stroke="#7c8fa8" stroke-width=".4"/><path d="${glyph}" transform="translate(81 ${y}) scale(.8)" fill="none" stroke="#aec0d2" stroke-width=".4"/><path d="M87 ${y-1}h9m-9 2h6" stroke="#899ab1" stroke-width=".35"/><path d="M79 ${y+3}h16" stroke="#3d526e" stroke-width=".25"/><path d="M75 ${y-1}v2" stroke="#988365" stroke-width=".45"/></g>`;}).join('')}
  </g>
  <g data-detail="empty-response-cradle" data-state="no-selection">
    <path d="M105 81h16v42h-16Z" fill="#050b15" stroke="#778ca5" stroke-width=".45"/>
    <g data-detail="arbitration-core-empty" data-selected="false"><path d="M110 88h7v15h-7Z" fill="none" stroke="#7d8ba3" stroke-width=".4" stroke-dasharray="1.5 1.5"/><path d="M112 95h3" stroke="#7c8fa7" stroke-width=".4"/></g>
    <path d="M108 85v19m11-19v19M110 119h7" stroke="#435970" stroke-width=".35"/>
    <path d="M106 87h2m-2 7h2m-2 7h2m-2 16h2m11-30h2m-2 7h2m-2 7h2m-2 16h2" stroke="#8c9eb6" stroke-width=".3"/>
    <g data-detail="closed-output-shutter" data-state="closed"><path d="M108 107h11v8h-11Z" fill="url(#metal)" stroke="#a7b9ca" stroke-width=".4"/><path d="M113.5 107v8m-4-6h8m-8 4h8" stroke="#0b1728" stroke-width=".45"/></g>
  </g>
  <g data-detail="owner-temporal-dock" data-electrical-state="isolated" data-owner-confirmation="required">
    <path d="M141 57h23l8 8v68l-6 6h-25Z" fill="url(#dark-metal)" stroke="#a8b9cd" stroke-width=".6"/>
    <path d="M136 58v77" stroke="#687991" stroke-width=".35" stroke-dasharray="1.5 2"/>
    <g data-detail="owner-calendar-module"><path d="M146 65h20v25h-20Z" fill="#081323" stroke="#9aabc1" stroke-width=".45"/><path d="M146 72h20m-16-9v5m12-5v5" stroke="#b0bdd1" stroke-width=".65"/>
      ${[0,1].flatMap(row=>[0,1,2].map(col=>`<path d="M${149+col*5} ${76+row*6}h3v3h-3Z" fill="#122037" stroke="#7d8da6" stroke-width=".3"/>`)).join('')}
    </g>
    <g data-detail="owner-temporal-clock" data-state="symbolic"><circle cx="153" cy="55" r="10.5" fill="url(#metal)" stroke="#a9bfd1" stroke-width=".55"/><circle cx="153" cy="55" r="7.8" fill="#081321" stroke="#9da7c4" stroke-width=".4"/>
      ${Array.from({length:12},(_,i)=>`<path d="M153 48v1" transform="rotate(${i*30} 153 55)" stroke="#a7b9cf" stroke-width=".3"/>`).join('')}
      <path d="M153 51v4l3 2" fill="none" stroke="#c0b2dd" stroke-width=".65"/><circle cx="153" cy="55" r=".8" fill="#a8b9d3"/>
    </g>
    <g data-detail="owner-preview-tray" data-mode="review-before-write"><path d="M146 95h15l5 4v11h-20Z" fill="#081321" stroke="#8d9eb8" stroke-width=".4"/><path d="M160 95v5h6m-17-1h8m-8 4h12m-12 3h8" fill="none" stroke="#a6b8cb" stroke-width=".35"/></g>
    <g data-detail="temporal-reservation-ledger" data-representation="illustrative"><path d="M146 115h19v8h-19Z" fill="#050d19" stroke="#6f86a1" stroke-width=".4"/><path d="M149 117h3v4h-3Zm6 0h7m-7 3h5" fill="none" stroke="#9caec4" stroke-width=".3"/></g>
    <g data-detail="manual-notification-port" data-delivery="separate-owner-confirmation"><path d="M147 134h9l-1-2v-3a3.5 3.5 0 0 0-7 0v3Zm3 1h3" fill="#111d2f" stroke="#b5c0d4" stroke-width=".45"/><path d="M160 130h5v5h-5Zm1 0v-1a1.5 1.5 0 0 1 3 0v1" fill="#07101d" stroke="#b0a0c6" stroke-width=".4"/></g>
  </g>
  <g data-detail="dual-physical-interlock">
    <g data-detail="planner-execution-isolator" data-state="cognitive-execution-blocked"><path d="M56 142h66v12H56Z" fill="url(#dark-metal)" stroke="#a1b2c8" stroke-width=".55"/><path d="M61 148h16m23 0h17" stroke="#718aa4" stroke-width=".5"/><path d="M83 146h12v6H83Zm2 0v-3a4 4 0 0 1 8 0v3" fill="#07111e" stroke="#c9a274" stroke-width=".6"/><path d="m77 146 3 4m-3 0 3-4m18 0 3 4m-3 0 3-4" stroke="#ad8697" stroke-width=".4"/><circle cx="89" cy="149" r=".8" fill="#c9a274"/></g>
    <g data-detail="owner-confirmation-interlock" data-state="confirmation-required"><path d="M136 142h28v12h-28Z" fill="url(#dark-metal)" stroke="#94a9c1" stroke-width=".5"/><path d="M140 146h8v5h-8Zm1 0v-2a3 3 0 0 1 6 0v2m4 4h8" fill="#081321" stroke="#b9a5d2" stroke-width=".45"/></g>
  </g>
  <g data-detail="drafting-bezel-illumination" data-motion-purpose="decorative-only"><path class="planner-bezel-reflection" d="M64 80v5m66-5v5" stroke="${b}" stroke-width=".75" filter="url(#soft-glow)"/></g>`;
}
