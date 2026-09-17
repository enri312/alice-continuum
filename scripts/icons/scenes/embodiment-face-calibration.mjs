// FaceTrackingPanel: passive readiness, neutral reference mesh and eight unread channels.
// Decorative bezel animation must never imply an open camera or live facial tracking.
export function faceCalibrationScene(a, b, { plinth, fastener }) {
  const channels = ['eyeBlinkLeft','eyeBlinkRight','jawOpen','mouthSmileLeft','mouthSmileRight','browInnerUp','gazeX','gazeY'];
  const landmarks = [[81,77],[88,75],[95,78],[105,78],[112,75],[119,77],[76,90],[124,90],[91,99],[100,102],[109,99],[85,114],[93,111],[100,113],[107,111],[115,114],[100,120],[86,126],[100,134],[114,126]];
  return `<style>
    [data-icon="face"] .alive{animation:none}
    .face-bezel-glint{animation:face-bezel-glint 4s ease-in-out infinite}
    @keyframes face-bezel-glint{0%,100%{transform:translateY(0);opacity:.25}50%{transform:translateY(45px);opacity:.9}}
    @media(prefers-reduced-motion:reduce){.face-bezel-glint{animation:none}}
  </style><defs>
    <linearGradient id="face-shell" x1="0" y1="0" x2="1" y2=".6"><stop stop-color="#111e30"/><stop offset=".32" stop-color="#6d859a"/><stop offset=".49" stop-color="#bccbd3"/><stop offset=".51" stop-color="#587488"/><stop offset=".8" stop-color="#1b3044"/><stop offset="1" stop-color="#0b1627"/></linearGradient>
    <linearGradient id="face-brow" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#819bad"/><stop offset=".46" stop-color="#2c455b"/><stop offset="1" stop-color="#0b1726"/></linearGradient>
    <linearGradient id="face-cheek" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a1b4c1" stop-opacity=".7"/><stop offset="1" stop-color="#101d30" stop-opacity=".2"/></linearGradient>
  </defs>
  ${plinth(a,b,158)}
  <g data-detail="face-calibration-bay" filter="url(#shadow)">
    <path d="M26 144V51l17-18h114l17 18v93l-11 11H37Z" fill="url(#dark-metal)" stroke="#b9c7d7" stroke-width="1.15"/>
    <path d="M53 137V57l10-14h75l9 14v80Z" fill="#040c17" stroke="#586b83" stroke-width=".55"/>
    <path d="M43 37h114M30 58v74m139-74v74M43 151h115" stroke="#8295ac" stroke-width=".35"/>
    <path d="M56 65V57l9-11h15m41 0h15l8 11v8M56 124v10h13m62 0h13v-10" fill="none" stroke="${a}" stroke-width=".65"/>
    ${fastener(37,46,a,1.35)}${fastener(162,46,b,1.35)}${fastener(35,145,b,1.25)}${fastener(166,145,a,1.25)}
  </g>
  <g data-detail="reference-mask-cradle" fill="none">
    <path d="M69 61 62 70v48l15 17m54-74 7 9v48l-15 17" stroke="#02050c" stroke-width="3.5"/>
    <path d="M69 61 62 70v48l15 17m54-74 7 9v48l-15 17" stroke="url(#metal)" stroke-width="1.3"/>
    <path d="M61 91h9m60 0h9M90 138h20l6 5H84Z" stroke="#94a8bc" stroke-width=".6"/>
    ${fastener(63,91,a,1.2)}${fastener(137,91,b,1.2)}
  </g>
  <g data-detail="reserved-landmark-lattice" data-input="reference-only" data-tracking="false">
    <path data-detail="sculpted-neutral-face" d="M100 48Q75 47 70 71l2 32 8 21 20 15 20-15 8-21 2-32Q125 47 100 48Z" fill="url(#face-shell)" stroke="#c1d2df" stroke-width=".75"/>
    <path d="M100 49 83 55 77 67 86 70 100 65l14 5 9-3-6-12Z" fill="url(#face-brow)" stroke="#92a9bc" stroke-width=".35"/>
    <path d="m73 84 8 8 11 7-7 15-9-14Zm54 0-8 8-11 7 7 15 9-14Z" fill="url(#face-cheek)" stroke="#99afbf" stroke-width=".4"/>
    <path d="m80 122 13 3 7 12 7-12 13-3-20 7Z" fill="#7693a4" fill-opacity=".45" stroke="#91a8b8" stroke-width=".35"/>
    <g data-detail="orbital-and-brow-contours" fill="none" stroke-linejoin="round">
      <path d="M77 74q9-6 19 0m8 0q10-6 19 0" stroke="#bdd0da" stroke-width=".75"/>
      <path d="M77 80q10-8 19 0-9 10-19 0Zm27 0q9-8 19 0-10 10-19 0Z" fill="#091929" stroke="#a0becf" stroke-width=".6"/>
      <path d="M79 79q8-4 15 0m12 0q8-4 15 0M81 85l8 2 6-3m10 0 6 3 8-2" stroke="${a}" stroke-width=".4"/>
      <path d="M98 75 94 90l-4 9 10 5 10-5-4-9-4-15" stroke="#d3e0e5" stroke-width=".55"/>
      <path d="m100 78-2 18-5 3 7 2Z" fill="#c7d9df" stroke="#d3e0e5" stroke-width=".35"/>
      <path d="m100 78 2 18 5 3-7 2Z" fill="#1c344a" stroke="#7b99ae" stroke-width=".35"/>
      <path d="m85 114 8-4 7 2 7-2 8 4-9 7H94Z" fill="#12263a" stroke="#a8c1d0" stroke-width=".55"/>
      <path d="M86 114h28m-21 4h14M94 127h12" stroke="#c2d4df" stroke-width=".4"/>
    </g>
    <g data-detail="facial-topology-guides" fill="none" stroke="#728ca2" stroke-width=".35" opacity=".9">
      <path d="M100 50v14m-25 6 6 7-5 13 9 24 1 12m39-56-6 7 5 13-9 24-1 12M81 77l7-2 7 3 5-13 5 13 7-3 7 2M76 90l15 9-6 15 8-3 7-9 7 9 8 3-6-15 15-9M86 126l7-15m14 0 7 15M85 114l15 20 15-20"/>
    </g>
    <g data-detail="reference-landmark-anchors">${landmarks.map(([x,y],i)=>`<circle data-detail="reference-landmark" cx="${x}" cy="${y}" r="${i<6?.85:1}" fill="#071322" stroke="${i<10?a:b}" stroke-width=".45"/><circle cx="${x}" cy="${y}" r=".3" fill="#d7eaf3"/>`).join('')}</g>
  </g>
  <g data-detail="camera-off-shutter" data-sensor="closed">
    <path d="M26 65h19l7 7v23l-6 6H26l-5-6V72Z" fill="url(#dark-metal)" stroke="#a8b9cc" stroke-width=".7"/>
    <path d="M29 65v-4h11v4m-13 5h18M24 76v16" fill="none" stroke="#8d9fb5" stroke-width=".5"/>
    <circle cx="36" cy="83" r="10.5" fill="url(#metal)" stroke="#b6c8d9" stroke-width=".65"/>
    <circle cx="36" cy="83" r="8" fill="#040b15" stroke="#809ab0" stroke-width=".5"/>
    <g data-detail="closed-privacy-blades" fill="#33475d" stroke="#93a7b8" stroke-width=".35"><path d="m29 79 7-3 7 4-7 3Zm0 0 7 4-1 7-6-4Zm7 4 7-3v6l-8 4Z"/></g>
    <path d="m27 92 18-18" stroke="#040912" stroke-width="2.2"/><path d="m27 92 18-18" stroke="#f08ea8" stroke-width=".95"/>
    <path d="M30 97h12" stroke="#6f8198" stroke-width=".4"/>
    ${fastener(25,73,a,.7)}${fastener(47,96,b,.7)}
  </g>
  <g data-detail="passive-readiness-cartridges" data-state="unmeasured">
    ${['model','runtime'].map((part,i)=>`<g data-readiness="${part}" transform="translate(28 ${108+i*19})"><path d="M0 0h16l4 4v11H0Z" fill="url(#dark-metal)" stroke="#8a9cb3" stroke-width=".55"/><path d="M4 4h8v7H4Z" fill="#050d18" stroke="#73879e" stroke-width=".4"/><path d="M2 5h2m-2 4h2m8-4h2m-2 4h2M6 2v2m4-2v2m-4 7v2m4-2v2M6 7h4" stroke="#b1c0d0" stroke-width=".3"/><path d="M16 6v5" stroke="#56677d" stroke-width=".6"/></g>`).join('')}
  </g>
  <g data-detail="expression-reserve-bank" data-state="unread">
    <path d="M149 54h16l7 7v76l-6 5h-17Z" fill="url(#dark-metal)" stroke="#97abc1" stroke-width=".65"/>
    <path d="M153 59h11m-13 2v74M153 138h11" stroke="#c2ceda" stroke-width=".3"/>
    ${channels.map((channel,i)=>`<g data-detail="reserved-facial-channel" data-channel="${channel}" data-state="unread" transform="translate(154 ${64+i*9})"><path d="M0 0h11l2 2v4l-2 1H0Z" fill="#040b15" stroke="#657c94" stroke-width=".35"/><path d="M2 2h3v3H2Z" fill="#142235" stroke="#91a2b7" stroke-width=".3"/><path d="M7 3.5h3" stroke="#94a3b8" stroke-width=".45"/><path d="M1 6h9" stroke="#33465c" stroke-width=".25"/></g>`).join('')}
    ${fastener(168,61,a,.65)}${fastener(167,136,b,.65)}
  </g>
  <g data-detail="r2-permission-interlock" data-activation="blocked">
    <path d="M65 143h70l5 5-5 5H65l-5-5Z" fill="url(#dark-metal)" stroke="#a4b5c9" stroke-width=".6"/>
    <path d="M67 147h22m22 0h22" stroke="#7389a1" stroke-width=".5"/><path d="M70 150h17m26 0h17" stroke="#42576e" stroke-width=".3"/>
    <path d="M94 144h12v8H94Zm3 0v-3a3 3 0 0 1 6 0v3" fill="#091221" stroke="#e6a0b5" stroke-width=".6"/>
    <circle cx="100" cy="147" r="1" fill="#e6a0b5"/><path d="M100 148v1.5" stroke="#e6a0b5" stroke-width=".5"/>
    <path data-detail="disconnected-retarget" d="m88 146 3 3m-3 0 3-3m18 0 3 3m-3 0 3-3" stroke="#a18caa" stroke-width=".5"/>
    ${fastener(65,148,a,.7)}${fastener(135,148,b,.7)}
  </g>
  <g data-detail="decorative-calibration-bezel" data-motion-purpose="decorative-only">
    <path d="M56 73v45m88-45v45" stroke="#38536b" stroke-width=".4"/>
    ${[73,82,91,100,109,118].map(y=>`<path d="M54 ${y}h3m86 0h3" stroke="#8da3b9" stroke-width=".3"/>`).join('')}
    <path class="face-bezel-glint" d="M54 73h3m86 0h3" stroke="${a}" stroke-width="1" filter="url(#soft-glow)"/>
  </g>`;
}
