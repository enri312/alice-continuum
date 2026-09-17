// Fixed bearing housing and shaft cap. The toothed rotor animates independently;
// the concentric hardware must never drift away from its common axle.
import { settingsSelectorCore } from './settings-selector-core.mjs';
export function gearToothCrown(cx, cy, radius) {
  const count = 12;
  const point = (angle, r) => {
    const rad = (angle-90)*Math.PI/180;
    return `${(Math.cos(rad)*r).toFixed(3)} ${(Math.sin(rad)*r).toFixed(3)}`;
  };
  // One continuous rim: broad, flat tooth crests and recessed root gaps.
  const profile = [[-15,radius+1.8],[-10,radius+1.8],[-8,radius+3],[-6,radius+9],[-4.8,radius+10.3],[4.8,radius+10.3],[6,radius+9],[8,radius+3],[10,radius+1.8]];
  const outline = Array.from({length:count},(_,i)=>profile.map(([angle,r])=>point(angle+i*30,r))).flat();
  return `<g data-detail="chamfered-gear-teeth" data-tooth-profile="wide-flat-crest-deep-root" transform="translate(${cx} ${cy})">
    <path data-detail="continuous-toothed-crown" d="M${outline.join(' L')}Z" fill="url(#metal)" stroke="#bdcddd" stroke-width=".7" stroke-linejoin="round"/>
    ${Array.from({length:count},(_,i)=>`<g data-detail="chamfered-gear-tooth" transform="rotate(${i*30})">
      <path data-detail="tooth-machined-flank" d="M${point(-7.1,radius+3.1)} L${point(-5.2,radius+8.8)} L${point(-4.2,radius+9.5)} L${point(4.2,radius+9.5)}" fill="none" stroke="#e4eef5" stroke-width=".45"/>
      <path d="M${point(7.1,radius+3.1)} L${point(5.2,radius+8.8)} L${point(4.2,radius+9.5)}" fill="none" stroke="#324e65" stroke-width=".65"/>
      <path d="M${point(-3.5,radius+8.5)} L${point(3.5,radius+8.5)}" stroke="#a6becf" stroke-width=".25"/>
      <path d="M${point(10.5,radius+2.3)} L${point(19.5,radius+2.3)}" stroke="#4b667e" stroke-width=".35"/>
    </g>`).join('')}
  </g>`;
}

export function precisionDriveHub(cx, cy, accent, secondary) {
  return `<g data-detail="fixed-drive-hub" transform="translate(${cx} ${cy})">
    <circle data-detail="dual-bearing" r="22.8" fill="#030912" stroke="#bacddd" stroke-width=".85"/>
    <circle r="21.7" fill="none" stroke="#455e76" stroke-width=".35"/>
    <circle r="20.8" fill="#07101b" stroke="#b3c8d8" stroke-width=".45"/>
    <g data-detail="bearing-race-machining" fill="none">
      <circle r="22.1" stroke="#e2edf5" stroke-width=".22" stroke-dasharray=".7 1.8" opacity=".6"/>
      <circle r="17" stroke="#91a9bd" stroke-width=".4"/>
      <path d="M-15-15a21.2 21.2 0 0 1 20-5.6m10 35.6a21.2 21.2 0 0 1-20 5.6" stroke="#e7f3fc" stroke-width=".35"/>
    </g>
    <g data-detail="bearing-ball-cage">
      ${Array.from({length:12},(_,i)=>`<g data-detail="individual-bearing-pocket" transform="rotate(${i*30})">
        <path d="M-2.5-20.5h5l.7 1.8-.7 1.8h-5l-.7-1.8Z" fill="url(#screw-metal)" stroke="#859bb0" stroke-width=".25"/>
        <circle cy="-18.7" r="1.95" fill="#01060c" stroke="#344c62" stroke-width=".25"/>
        <circle data-detail="bearing-ball" cy="-18.7" r="1.38" fill="${i%3===0?accent:'url(#metal)'}" stroke="#bbd1df" stroke-width=".28"/>
        <path d="M-.8-19.4q.7-.7 1.4 0" fill="none" stroke="#fff" stroke-width=".3" opacity=".8"/>
        <path d="M3.5-19v1.1" stroke="#a2b5c5" stroke-width=".3"/>
      </g>`).join('')}
    </g>
    <g data-detail="bearing-cage-bridges">
      ${Array.from({length:12},(_,i)=>`<g data-detail="bearing-separator-bridge" transform="rotate(${15+i*30})">
        <path d="M-.85-20.2h1.7v3H-.85Z" fill="url(#dark-metal)" stroke="#7996ac" stroke-width=".25"/>
        <path d="M-.4-19.7v2m.8-2v2" stroke="#adc5d5" stroke-width=".22"/>
        <circle cy="-18.7" r=".45" fill="#06111c" stroke="#b7cbd9" stroke-width=".2"/>
      </g>`).join('')}
    </g>
    ${settingsSelectorCore(accent, secondary)}
  </g>`;
}

// Mounted on the rotating web, never on the stationary hub or the backplane.
export function precisionRotorDetails(cx, cy, radius, accent, secondary) {
  const outerRace = radius - .2;
  return `<g data-detail="rotor-machined-components" transform="translate(${cx} ${cy})">
    <g data-detail="segmented-collar-finish" fill="none">
      <circle r="${outerRace}" stroke="#21384e" stroke-width=".28"/>
      <circle r="${outerRace-.65}" stroke="#cfdee9" stroke-width=".3" stroke-dasharray="${2*Math.PI*(outerRace-.65)/16-1.5} 1.5"/>
    </g>
    <g data-detail="spoke-inset-reinforcements">
      ${Array.from({length:6},(_,i)=>`<g data-detail="machined-spoke-insert" transform="rotate(${i*60})">
        <path d="M-2.5-31.5h5v6.3l-1.2 1.2h-2.6l-1.2-1.2Z" fill="url(#metal)" stroke="#c1d1dd" stroke-width=".35"/>
        <path d="M-1.55-30.7h3.1v4.8h-3.1Z" fill="#06111e" stroke="#46627b" stroke-width=".25"/>
        <path d="M0-28.8v2.3" stroke="${i%2?secondary:accent}" stroke-width=".4"/>
        <circle cy="-29.7" r=".75" fill="url(#screw-metal)" stroke="#a7bfce" stroke-width=".2"/>
        <path d="M-.35-29.7h.7m-1 5.1h1.3" stroke="#173249" stroke-width=".3"/>
      </g>`).join('')}
    </g>
    <g data-detail="web-pocket-machining" fill="none">
      ${Array.from({length:6},(_,i)=>`<g transform="rotate(${30+i*60})">
        <path d="M-4-32.8q4-1.6 8 0" stroke="#bfd0dd" stroke-width=".4"/>
        <path d="M-3.3-31.8q3.3-1.2 6.6 0" stroke="#445e75" stroke-width=".3"/>
        <path d="M-4.5-30.8v2m9-2v2" stroke="#9bb3c8" stroke-width=".28"/>
      </g>`).join('')}
    </g>
  </g>`;
}
