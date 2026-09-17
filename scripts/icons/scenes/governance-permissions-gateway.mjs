// R2: prepare -> explicit decision -> ephemeral grant -> separate execution; deny by default.
export function permissionGatewayScene(a, b, { plinth, fastener }) {
  return `<style>
    [data-icon="gateway"] .alive{animation:none}
    .gateway-bezel-glint{animation:gateway-bezel-glint 4s ease-in-out infinite}
    @keyframes gateway-bezel-glint{0%,100%{transform:translateY(0);opacity:.3}50%{transform:translateY(36px);opacity:1}}
    @media(prefers-reduced-motion:reduce){.gateway-bezel-glint{animation:none}}
  </style><defs>
    <linearGradient id="gate-armor" x1="0" y1="0" x2="1" y2=".6"><stop stop-color="#a2b8cc"/><stop offset=".18" stop-color="#3d526a"/><stop offset=".5" stop-color="#142238"/><stop offset=".8" stop-color="#617b93"/><stop offset="1" stop-color="#13253d"/></linearGradient>
  </defs>
  ${plinth(a,b,160)}
  <g data-detail="permission-airlock-chassis" filter="url(#shadow)">
    <path d="M24 145V55l19-21h114l19 21v90l-11 10H35Z" fill="url(#dark-metal)" stroke="#bdcddd" stroke-width="1.1"/>
    <path d="M32 137V60l15-17h106l15 17v77Z" fill="#040b16" stroke="#506580" stroke-width=".55"/>
    <path d="M43 38h114M28 66v63m144-63v63M41 151h119" stroke="#94aac2" stroke-width=".35"/>
    ${fastener(34,51,a,1.3)}${fastener(166,51,b,1.3)}${fastener(34,145,b,1.2)}${fastener(166,145,a,1.2)}
  </g>
  <g data-detail="owner-decision-airlock">
    <path d="M77 47h45l12 13v68l-11 10H77l-11-10V60Z" fill="url(#metal)" stroke="#a9bfd2" stroke-width=".8"/>
    <path d="M80 54h39l8 9v61l-8 7H80l-7-7V63Z" fill="#050b15" stroke="#c2ceda" stroke-width=".5"/>
    <g data-detail="deny-by-default-bulkhead" data-state="closed">
      <path d="M80 58h18v68H80l-3-5V64Z" fill="url(#gate-armor)" stroke="#9bb3c9" stroke-width=".55"/>
      <path d="M102 58h16l5 6v57l-5 5h-16Z" fill="url(#gate-armor)" stroke="#9bb3c9" stroke-width=".55"/>
      <path d="M82 63h12v13H82Zm24 0h12v13h-12ZM82 109h12v12H82Zm24 0h12v12h-12Z" fill="#15283e" stroke="#718da7" stroke-width=".4"/>
      <g data-detail="bulkhead-locking-actuators">
        ${[82,106].flatMap(x=>[63,109].map(y=>`<g><path d="M${x+3} ${y+2}h6v9h-6Z" fill="url(#metal)" stroke="#9aaec2" stroke-width=".3"/><path d="M${x+6} ${y+3}v7" stroke="#0b192a" stroke-width=".7"/><path d="M${x+4} ${y+4}h4m-4 4h4" stroke="#c0d0dc" stroke-width=".3"/><circle cx="${x+1.5}" cy="${y+2}" r=".45" fill="#acbfd0"/><circle cx="${x+10.5}" cy="${y+11}" r=".45" fill="#acbfd0"/></g>`)).join('')}
      </g>
      <path d="M80 83h3v19h-3m37-19h3v19h-3" fill="#0c1b2d" stroke="#5e7994" stroke-width=".3"/>
      <path d="M81.5 87v11m37-11v11" stroke="#99b4cc" stroke-width=".4"/>
      <path d="M81 80h13m12 0h13M81 105h13m12 0h13M100 59v15m0 35v17" stroke="#b0c4d5" stroke-width=".4"/>
      <path d="M76 71h4v7h-4m0 30h4v7h-4m44-44h4v7h-4m0 30h4v7h-4" fill="url(#metal)" stroke="#9aaec3" stroke-width=".35"/>
    </g>
    <g data-detail="keyed-policy-lock"><path d="m100 77 14 8v16l-14 8-14-8V85Z" fill="url(#metal)" stroke="#c6d8e6" stroke-width=".7"/><path d="m100 81 10 6v12l-10 6-10-6V87Z" fill="#071322" stroke="${a}" stroke-width=".5"/><path d="M95 91h10v10H95Zm2 0v-4a3 3 0 0 1 6 0v4" fill="#142a3e" stroke="#d0e0e8" stroke-width=".75"/><circle cx="100" cy="95" r="1.4" fill="${a}"/><path d="M100 96v2" stroke="${a}" stroke-width=".7"/></g>
    ${[[72,61],[128,61],[72,125],[128,125]].map(([x,y],i)=>fastener(x,y,i%2?a:b,1)).join('')}
  </g>
  <g data-detail="prepared-request-capsule" data-state="review-required">
    <path d="M29 60h24l9 9v44H29Z" fill="url(#dark-metal)" stroke="#adbed2" stroke-width=".65"/>
    <path d="M53 60v9h9M33 64h15" fill="none" stroke="#bdccdc" stroke-width=".4"/>
    ${['resource','dataScopes','effects'].map((field,i)=>`<g data-request-field="${field}"><path d="M33 ${73+i*11}h23v8H33Z" fill="#06101d" stroke="#627d98" stroke-width=".35"/><path d="M36 ${75+i*11}h4v4h-4Zm7 1h9m-9 2h6" fill="none" stroke="#a8bbd0" stroke-width=".3"/></g>`).join('')}
    <g data-detail="immutable-request-digest">${[0,1,2,3,4,5,6,7].map(i=>`<path d="M${34+i*3} 108v${i%3?2:3}" stroke="#8fa6be" stroke-width="${i%2?.5:.9}"/>`).join('')}</g>
    <path d="M62 87h4" stroke="#8fa5bf" stroke-width=".6"/>
  </g>
  <g data-detail="explicit-owner-decision" data-decision="required"><path d="M29 118h30v14H29Z" fill="url(#dark-metal)" stroke="#9aacc3" stroke-width=".5"/><path d="M32 121h10v8H32Zm14 0h10v8H46Z" fill="#07101d" stroke="#6d829d" stroke-width=".35"/><path d="m34 124 2 2 4-4m8 0 5 5m-5 0 5-5" fill="none" stroke="#bdd0df" stroke-width=".6"/></g>
  <g data-detail="ephemeral-grant-cartridge" data-storage="ephemeral">
    <path d="M142 76h21l8 7v45l-7 7h-22Z" fill="url(#dark-metal)" stroke="#afc2d7" stroke-width=".65"/>
    <path d="M147 82h15l4 4v31h-19Z" fill="#071321" stroke="#708ca8" stroke-width=".45"/>
    <path d="m155 86 6 3v8l-6 4-6-4v-8Z" fill="none" stroke="#b4cadb" stroke-width=".45"/>
    <g data-detail="scoped-grant-chip"><path d="M152 90h6v6h-6Z" fill="url(#metal)" stroke="#c0d0dc" stroke-width=".3"/><path d="M154 92h2v2h-2Z" fill="#071120" stroke="${a}" stroke-width=".25"/><path d="M150 91h2m-2 3h2m6-3h2m-2 3h2m-6-6v2m2-2v2m-2 6v2m2-2v2" stroke="#a8bfd2" stroke-width=".3"/></g>
    <path d="M152 105h10m-10 4h7m-7 4h10" stroke="#9fb4cb" stroke-width=".4"/>
    <path d="M149 105v8m15-27v10" stroke="#627f9c" stroke-width=".3"/>
    <g data-detail="grant-scope-contacts">${[0,1,2,3,4].map(i=>`<path d="M${146+i*4} 125v5" stroke="${i%2?'#96aec6':b}" stroke-width=".65"/>`).join('')}</g>
    <path d="M134 94h5m0-3v6" stroke="#a1b5cc" stroke-width=".5"/>
  </g>
  <g data-detail="lease-expiry-dial" data-timer="symbolic">
    <path d="M151 73v3" stroke="#9caec3" stroke-width="1.1"/>
    <circle cx="152" cy="59" r="14" fill="url(#metal)" stroke="#bacddd" stroke-width=".65"/>
    <circle cx="152" cy="59" r="10.5" fill="#061221" stroke="#869eb9" stroke-width=".5"/>
    <g stroke="#a9b8cc" stroke-width=".35">${Array.from({length:12},(_,i)=>`<path d="M152 47v1.4" transform="rotate(${i*30} 152 59)"/>`).join('')}</g>
    <path d="M148 53h8v3l-3 3 3 3v3h-8v-3l3-3-3-3Z" fill="#12263b" stroke="${b}" stroke-width=".55"/><path d="m149 54 3 3 3-3m-6 10 3-3 3 3" fill="none" stroke="#d3b8a4" stroke-width=".35"/>
  </g>
  <g data-detail="revocation-breaker"><path d="M59 140h54l5 5-5 8H59l-5-8Z" fill="url(#dark-metal)" stroke="#a2b6cb" stroke-width=".55"/><path d="M63 146h15m20 0h13" stroke="#8296b0" stroke-width=".65"/><path d="M79 149 96 140" stroke="#040912" stroke-width="2.3"/><path d="M79 149 96 140" stroke="#dc9aa8" stroke-width=".95"/>${fastener(80,148,b,1.4)}<path d="M92 139h7v3h-7Z" fill="#713b48" stroke="#cc99a6" stroke-width=".4"/></g>
  <g data-detail="separate-execution-port" data-execution="separate-action-required"><path d="M126 140h36v13h-36Z" fill="url(#dark-metal)" stroke="#9bb2ca" stroke-width=".55"/><path d="M130 146h7m9 0h11m-20-2v4m9-4v4" stroke="#a1b3c9" stroke-width=".55"/><path d="m139 144 4 4m-4 0 4-4" stroke="#ad93ae" stroke-width=".5"/></g>
  <g data-detail="gateway-edge-illumination" data-motion-purpose="decorative-only"><path d="M69 73v39m62-39v39" stroke="#2f506a" stroke-width=".45"/><path class="gateway-bezel-glint" d="M69 73v3m62-3v3" stroke="${a}" stroke-width=".85" filter="url(#soft-glow)"/></g>`;
}
