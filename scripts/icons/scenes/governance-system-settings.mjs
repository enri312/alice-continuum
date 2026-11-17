import { contactRail, readout, tube } from "../shared/workshop-parts.mjs";
import { plate, line, pin, dial, bolt, coupling, conduit } from "../shared/instrument.mjs";
import { gearToothCrown } from "../shared/gear-drive-hub.mjs";

export default function settings(accent, secondary) {
  return `${tube("M19 34 11 38 8 49l3 14 11 8",accent)}
  <g transform="translate(2 -4) scale(.94)"><g data-component="drive-mount">
    ${plate("M12 40 34 17 58 19 78 37V60L62 76 27 79 10 63Z","dark-metal")}
    ${conduit("M72 37l12 4 6 7v13l-7 5",secondary)}
    ${coupling(87,49,78,secondary)}${bolt(16,60)}${bolt(72,38)}
  </g>
  <g data-part="configuration-rotor">
    <g transform="translate(3 1)">${gearToothCrown(42,43,25)}</g>
    ${dial(45,44,21)}${pin(45,44,6,secondary)}
    ${line("M34 53q-8-12 5-21",accent,1.35)}
    ${plate("M39 59 72 51 85 57V75L49 86 38 80Z","dark-metal")}
    ${line("M45 65l31-8M45 73l31-8","#7996ab",1.15)}
    ${pin(54,63,2.6,accent)}${pin(67,67,2.6,secondary)}
  <g data-component="shaft-encoder">
    ${[0,60,120,180,240,300].map(a=>`<g transform="rotate(${a} 45 44)">${plate("M42 23h6l-1 8h-4Z","dark-metal")}${bolt(45,27,.9)}</g>`).join("")}
    ${line("M40 44l3-5h5l3 5-3 4h-5Z","#e5e6d7",.85)}
    ${bolt(42,77,1.1)}${bolt(81,60,1.2)}
  </g>
  </g></g>
  <g data-component="service-connector">
  ${plate("M15 74 28 68 51 76 80 68 88 74V82L54 93 17 85Z","dark-metal")}
  ${readout(21,74,27,12,"M4 11h5V5h6v5h5V7h9",accent)}${contactRail(56,83,7,-17,secondary)}</g>`;
}
