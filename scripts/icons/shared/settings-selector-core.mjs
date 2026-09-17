// A symbolic adjustment selector, not a live readout or an interactive control.
// Its three recessed sliders make Configuration legible without text.
export function settingsSelectorCore(accent, secondary) {
  const polygon = (radius, count, offset = -90) => Array.from({length:count},(_,i)=>{
    const angle=(offset+i*360/count)*Math.PI/180;
    return `${(Math.cos(angle)*radius).toFixed(3)},${(Math.sin(angle)*radius).toFixed(3)}`;
  }).join(' ');
  const bevelFaces = Array.from({length:8},(_,i)=>{
    const corners = [10.7,9.6].map(radius=>[i,i+1].map(index=>{
      const angle=(22.5+index*45)*Math.PI/180;
      return `${(Math.cos(angle)*radius).toFixed(3)},${(Math.sin(angle)*radius).toFixed(3)}`;
    }));
    return `<polygon data-detail="selector-machined-facet" points="${corners[0][0]} ${corners[0][1]} ${corners[1][1]} ${corners[1][0]}" fill="${['#45657c','#243e54','#36536b','#7898ac','#c0d4e0','#90adbf','#597990','#2b485e'][i]}" stroke="#65869d" stroke-width=".18"/>`;
  }).join('');
  return `<g data-detail="configuration-selector-core" data-representation="symbolic-settings">
    <circle r="16.3" fill="url(#metal)" stroke="#c8dbe7" stroke-width=".5"/>
    <circle r="15.2" fill="#071321" stroke="#718fa6" stroke-width=".35"/>
    <g data-detail="selector-index-scale" fill="none">
      ${Array.from({length:24},(_,i)=>`<path d="M0-14.65v${i%3?.55:1.1}" transform="rotate(${i*15+7.5})" stroke="${i%3?'#70899f':'#c7d7e3'}" stroke-width="${i%3?.22:.35}"/>`).join('')}
    </g>
    <g data-detail="selector-mounting-bolts">
      ${[45,135,225,315].map(angle=>`<g data-detail="selector-flush-fastener" transform="rotate(${angle}) translate(0 -13.55)">
        <circle r="1.45" fill="#020812" stroke="#6a869b" stroke-width=".25"/>
        <circle r="1.05" fill="url(#screw-metal)" stroke="#becfdb" stroke-width=".22"/>
        <polygon points="${polygon(.57,6)}" fill="#03101b" stroke="#47667d" stroke-width=".18"/>
      </g>`).join('')}
    </g>
    <g data-detail="selector-segmented-light-guide" fill="none">
      <circle r="11.8" stroke="#1a3b50" stroke-width=".7"/>
      ${[0,120,240].map(angle=>`<path d="M-9.35-7.2A11.8 11.8 0 0 1 7.2-9.35" transform="rotate(${angle})" stroke="${accent}" stroke-width=".6"/>`).join('')}
    </g>
    <g data-detail="faceted-selector-knob">
      <polygon points="${polygon(10.7,8,22.5)}" fill="url(#metal)" stroke="#d0e1ea" stroke-width=".45"/>
      <g data-detail="selector-faceted-bezel">${bevelFaces}</g>
      <polygon points="${polygon(9.6,8,22.5)}" fill="#152e41" stroke="#68899e" stroke-width=".3"/>
      <polygon points="${polygon(9.2,8,22.5)}" fill="#020912" stroke="#07121e" stroke-width=".25"/>
      <polygon points="${polygon(8.9,8,22.5)}" fill="#04111e" stroke="#a1bdce" stroke-width=".3"/>
      <path d="M-7.8-4v-3l2-1M7.8 4v3l-2 1" fill="none" stroke="#e0eef5" stroke-width=".3" opacity=".8"/>
      <g data-detail="selector-edge-grips" stroke="#173348" stroke-width=".3">
        ${[0,90,180,270].map(angle=>`<path d="M-2.5-9.8v.5m1.25-.5v.5m1.25-.5v.5m1.25-.5v.5m1.25-.5v.5" transform="rotate(${angle})"/>`).join('')}
      </g>
      <g data-detail="selector-face-retainers">
        ${[[-5.8,-5.8],[5.8,-5.8],[-5.8,5.8],[5.8,5.8]].map(([x,y])=>`<g transform="translate(${x} ${y})"><circle r=".7" fill="#01060c" stroke="#5d7a91" stroke-width=".18"/><circle r=".47" fill="url(#screw-metal)"/><path d="M-.22-.13h.44v.26h-.44Z" fill="#102d43"/></g>`).join('')}
      </g>
      <g data-detail="selector-face-registration" fill="none" stroke-width=".2">
        <path d="M-2.5-6.9h5v.65h-5Zm0 13.15h5v.65h-5Z" stroke="#4b6c85"/>
        <path d="M-1.6-6.55h.65m.6 0h.65m.6 0h.65M-1.6 6.55h.65m.6 0h.65m.6 0h.65" stroke="#9ebccd"/>
      </g>
    </g>
    <g data-detail="recessed-configuration-sliders">
      ${[[-4,-2.4],[0,2.2],[4,-.6]].map(([y,x],i)=>`<g data-detail="symbolic-adjustment-slider" transform="translate(0 ${y})">
        <path d="M-5.8-1.15H5.8v2.3H-5.8Z" fill="#01060d" stroke="#4a6b85" stroke-width=".3"/>
        <g data-detail="slider-recess-bevel" fill="none" stroke-width=".2">
          <path d="M-5.55 .9v-1.8h11.1" stroke="#9ebacc"/>
          <path d="M-5.55 .9h11.1V-.9" stroke="#142f45"/>
        </g>
        <path d="M-5 0H5" stroke="#b2cbdc" stroke-width=".4"/>
        <path d="M-5 .65H5" stroke="#25465f" stroke-width=".2"/>
        <g data-detail="slider-end-stops" fill="url(#screw-metal)" stroke="#7694aa" stroke-width=".18">
          <path d="M-5.55-.55h.75v1.1h-.75Zm10.35 0h.75v1.1H4.8Z"/>
        </g>
        <g data-detail="slider-position-engraving" stroke="#678ca5" stroke-width=".18">
          ${[-4,-2,0,2,4].map(x=>`<path d="M${x} 1.25v.4"/>`).join('')}
        </g>
        <g data-detail="machined-slider-thumb" transform="translate(${x} 0)">
          <path d="M-1.2-1.7h2.4l.45.45v2.5l-.45.45h-2.4l-.45-.45v-2.5Z" fill="url(#screw-metal)" stroke="#d7e7f0" stroke-width=".28"/>
          <g data-detail="slider-thumb-chamfer" fill="none" stroke-width=".2">
            <path d="M-1.35 1.1v-2.2l.35-.35h2" stroke="#f0f7fa"/>
            <path d="M-1 1.45h2l.35-.35v-2.2" stroke="#3f5d74"/>
            <path d="M-1.05-.65v1.3m2.1-1.3v1.3" stroke="#52758d"/>
          </g>
          <path d="M-.55-1.05h1.1v2.1h-1.1Z" fill="#0a2032" stroke="${i===1?secondary:accent}" stroke-width=".28"/>
          <path d="M-.3-.35h.6m-.6.7h.6" stroke="#cfecf7" stroke-width=".18"/>
        </g>
      </g>`).join('')}
    </g>
    <g data-detail="selector-reference-notch">
      <path d="M-1-13.9h2v2h-2Z" fill="#06111c" stroke="#8faabc" stroke-width=".3"/>
      <path d="M0-13.45v1.1" stroke="${secondary}" stroke-width=".65"/>
    </g>
  </g>`;
}
