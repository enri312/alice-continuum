// BodySolverPanel is a reserved pipeline, not the live/manual Avatar IK viewer.
export function bodyCalibrationScene(a, b, { plinth, fastener, kinematicJoint, socket }) {
  const segments = [
    [91,76,91,113,3.1], [72,87,61,107,2.4], [61,107,54,125,2],
    [110,87,121,107,2.4], [121,107,128,125,2],
    [83,117,78,135,2.7], [78,135,75,151,2.1],
    [99,117,104,135,2.7], [104,135,107,151,2.1],
  ];
  const struts = segments.map(([x,y,xx,yy,w])=>{
    const length = Math.hypot(xx-x,yy-y);
    const angle = Math.atan2(yy-y,xx-x)*180/Math.PI-90;
    return `<g data-detail="tapered-rig-strut" transform="translate(${x} ${y}) rotate(${angle})">
      <path d="M${-w} 3H${w}L${w*.65} ${length-3}H${-w*.65}Z" fill="url(#metal)" stroke="#94a3b8" stroke-width=".48"/>
      <path d="M0 5v${Math.max(0,length-10)}" stroke="#030914" stroke-width=".75"/>
      <path d="M${-w*.55} 5v${Math.max(0,length-12)}" stroke="${a}" stroke-width=".3" opacity=".65"/>
    </g>`;
  }).join('');
  const joints = [[91,77],[72,87],[110,87],[61,107],[121,107],[54,125],[128,125],[91,115],[83,117],[99,117],[78,135],[104,135],[75,151],[107,151]];
  return `${plinth(a,b,156)}
  <g data-detail="ik-solver-gantry" filter="url(#shadow)">
    <path d="M24 144V53l17-18h118l17 18v91l-9 10H33Z" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width="1.15"/>
    <path d="M33 138V59l13-14h108l13 14v79H33Z" fill="#030914" stroke="#475569" stroke-width=".65"/>
    <path d="M48 39h104M29 64v25m143-25v25" stroke="#94a3b8" stroke-width=".38"/>
    ${fastener(32,52,a,1)}${fastener(168,52,b,1)}${fastener(32,146,b,.85)}${fastener(168,146,a,.85)}
  </g>
  <g data-detail="reserved-solver-pipeline" data-state="disconnected">
    ${['raw','filter','ik','spring','retarget'].map((stage,i)=>`<g data-stage="${stage}"><path d="M${48+i*23} 43h17v9h-17Z" fill="#020812" stroke="#64748b" stroke-width=".45"/><path d="M${52+i*23} 47h8" stroke="#94a3b8" stroke-width=".45"/></g>`).join('')}
  </g>
  <g data-detail="tracker-device-array" data-state="no-devices">
    <path d="M36 63v65" stroke="#475569" stroke-width=".45"/>
    ${['hub','imu','driver','poses','packets'].map((device,i)=>`<g data-device="${device}" transform="translate(39 ${69+i*13})"><path d="M-9-5H5l4 4v6H-9Z" fill="url(#dark-metal)" stroke="#94a3b8" stroke-width=".45"/><path d="M-6-2H2v5H-6Z" fill="#020812" stroke="#475569" stroke-width=".35"/><path d="M-4 .5h4" stroke="#64748b" stroke-width=".35"/><circle cx="6" cy="3" r=".8" fill="#334155"/></g>`).join('')}
  </g>
  <g data-detail="orientation-solver" data-state="reference-only">
    <path d="M67 68a24 14 0 0 1 48 0" fill="none" stroke="#64748b" stroke-width=".5" stroke-dasharray="2 2"/>
    <path d="M91 53v5m-25 10h5m40 0h5" stroke="${a}" stroke-width=".5"/>
  </g>
  <g data-detail="articulated-body-rig" data-state="reference-only">
    ${struts}
    <path d="m91 58 8 4 2 8-5 7H86l-5-7 2-8Z" fill="url(#metal)" stroke="#cbd5e1" stroke-width=".65"/>
    <path d="M84 66h14m-13 5 6 2 6-2" fill="none" stroke="#475569" stroke-width=".45"/>
    <path d="m72 84 19-5 19 5-6 19-13 7-13-7Z" fill="url(#dark-metal)" stroke="#cbd5e1" stroke-width=".75"/>
    <g data-detail="segmented-thoracic-plates"><path d="m78 86 10 2v8l-12-5Zm26 0-10 2v8l12-5Z" fill="url(#metal)" stroke="#94a3b8" stroke-width=".4"/>
      <path d="m79 97 9 3v5l-8-4m23-4-9 3v5l8-4" fill="none" stroke="${a}" stroke-width=".48"/>
      <path d="M91 84v22" stroke="#64748b" stroke-width=".5"/>
    </g>
    <path d="M80 109h22l3 8-7 6H84l-7-6Z" fill="url(#metal)" stroke="#cbd5e1" stroke-width=".55"/>
    <path d="M83 112h16l-3 6H86Z" fill="#020812" stroke="#64748b" stroke-width=".35"/>
    ${joints.map(([x,y],i)=>kinematicJoint(x,y,i%2?a:b,'#94a3b8',i===7?2:1.35).replace('class="blink"','')).join('')}
  </g>
  <g data-detail="inverse-kinematics-constraints" data-state="uncalculated" fill="none" stroke="#94a3b8" stroke-width=".45">
    <path d="M54 102a9 9 0 0 0 11 13m52 0a9 9 0 0 0 11-13M71 131a9 9 0 0 0 12 12m16 0a9 9 0 0 0 12-12" stroke-dasharray="2 1.5"/>
    <path d="M66 119v-4h5m40 0h5v4M87 129h8m-4-4v8"/>
  </g>
  <g data-detail="floor-contact-targets" data-state="reference-only">
    ${[75,107].map((x,i)=>`<g><path d="M${x-12} 150h24l4 5-4 5h-24l-4-5Z" fill="url(#dark-metal)" stroke="${i?b:a}" stroke-width=".65"/><ellipse cx="${x}" cy="155" rx="8" ry="2.5" fill="none" stroke="#64748b" stroke-width=".4"/><path d="M${x-5} 155h10m-5-3v6" stroke="#cbd5e1" stroke-width=".4"/></g>`).join('')}
  </g>
  <g data-detail="solver-telemetry" data-state="no-data">
    <path d="M139 61h22v47h-22Z" fill="url(#dark-metal)" stroke="#64748b" stroke-width=".65"/>
    <g data-detail="solver-panel-registration" fill="none" stroke="#a2b5ca" stroke-width=".28"><path d="M142 63h16M140 69v33m20-33v33M142 106h16"/></g>
    ${Array.from({length:15},(_,i)=>`<g data-detail="unmeasured-solver-metric"><path d="M${142+i%3*6} ${66+Math.floor(i/3)*8}h4v5h-4Z" fill="#020812" stroke="#475569" stroke-width=".28"/><path d="M${143+i%3*6} ${68.5+Math.floor(i/3)*8}h2" stroke="#94a3b8" stroke-width=".35"/></g>`).join('')}
  </g>
  <g data-detail="inactive-retarget-output" data-state="blocked"><path d="M139 113h22v28h-22Z" fill="#020812" stroke="#475569" stroke-width=".5"/>
    <g opacity=".65" stroke="#94a3b8" stroke-width=".55" fill="none"><circle cx="150" cy="119" r="2.6"/><path d="M150 122v10m-5-8h10m-5 8-4 6m4-6 4 6"/></g>
    <path d="M145 143h10v9h-10Zm2 0v-3a3 3 0 0 1 6 0v3" fill="#020812" stroke="${a}" stroke-width=".65"/>
  </g>
  <g data-detail="sealed-sensor-input">${socket(21,139,a,b,4.5)}<path d="M28 139h14m-6-5v10m4-10v10" stroke="#64748b" stroke-width=".55"/><path class="pulse" d="M33 132h10" stroke="${a}" stroke-width=".5"/></g>`;
}
