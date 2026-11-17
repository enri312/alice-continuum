import { readout, tube } from "../shared/workshop-parts.mjs";
import { plate, line, dial, bolt, coupling } from "../shared/instrument.mjs";

export default function audit(accent, secondary) {
  return `${tube("M15 26 9 36v31l11 9 22 6",accent)}
  <g transform="translate(3 -4) scale(.94)"><g data-component="evidence-binding">
    ${plate("M10 25 19 21 23 26V76L15 83 9 77Z","dark-metal")}
    ${[35,48,61].map(y=>coupling(16,y,-10,secondary)).join("")}
  </g>
  <g data-part="evidence-lens">
    ${plate("M18 20 52 13 65 22V71L24 81 15 76V25Z")}
    ${plate("M23 25 50 20 59 27V67L22 75Z","dark-metal")}
    ${line("M28 32l19-4M28 38l15-3M28 44l18-4M28 64l11-2","#a8c0cd",1.6)}
    ${plate("M63 66l5-5 17 13q4 5 0 9-3 4-7 0Z","metal")}
    ${dial(55,52,18)}
    ${line("M42 54h5l4-7 4 12 5-11 3 4h5",accent,2.2)}
    ${line("M42 44q4-6 10-6","#eefaff",1.4)}
  <g data-component="forensic-probe">
    ${coupling(75,72,42,secondary)}
    ${line("M28 48l9-2m-9 6 5-1m-5 17 13-3","#a1b7c5",1.1)}
    ${line("M57 39l4 1m-9 27 6-1m-13-8 2 3", "#c3d6e2",.85)}
    ${bolt(23,21,1.1)}${bolt(22,73,1.1)}
  </g>
  </g></g>
  <g data-component="evidence-scanner">
  ${plate("M9 71l12-6 27 7 5 8-12 9-28-7Z","metal")}
  ${readout(15,70,29,14,"M4 11h5V6h3v5h4V4h3v6h9",secondary)}
  ${line("M49 80l9-5",accent,2)}</g>`;
}
