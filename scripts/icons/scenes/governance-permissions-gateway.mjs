import { fork, tube } from "../shared/workshop-parts.mjs";
import { plate, line, dial, bolt, coupling } from "../shared/instrument.mjs";

export default function permissions(accent, secondary) {
  return `${tube("M18 61 12 71 18 82l17 4",secondary)}
  <g transform="translate(4 -6) scale(.95)"><g data-component="locking-yoke">
    ${plate("M13 24 17 19 23 21V52L29 63 26 72 18 67 12 53Z","dark-metal")}
    ${plate("M75 20l8-3 5 6v29l-7 12-7-5 6-15Z","dark-metal")}
    ${coupling(17,41,90,secondary)}${coupling(82,34,90,secondary)}
  </g>
  <g data-part="permission-shield">
    ${plate("M48 9Q62 19 80 21V43Q80 65 49 84 18 65 18 43V21Q34 19 48 9Z")}
    ${plate("M48 17Q61 25 73 26V43Q72 60 49 75 25 60 25 43V27Q38 24 48 17Z","glass",accent)}
    ${line("M49 23v43M30 31v12q0 8 5 13","#a1d1da",.9)}
    ${dial(48,43,12)}
    ${plate("M47 38h3l2 3-1 4-2 2 2 7h-8l2-8-2-3 1-3Z","dark-metal")}
    <g transform="rotate(-38 73 66)">
    ${plate("M58 62H89V68H85V72H81V68H77V71H73V68H58Z","metal",secondary)}
    <circle cx="57" cy="65" r="8" fill="#bd8447" stroke="#ffdda1" stroke-width="1.7"/>
    <circle cx="56" cy="65" r="3.5" fill="#162537" stroke="#7b5638" stroke-width="1.5"/>
    </g>
  <g data-component="lock-escutcheon">
    ${line("M29 32l8-3 4-5m-12 22 5 11 8 5m21-34-4 5 4 5m-1 12-6 7v6",accent,1.1)}
    ${bolt(29,29,1.35)}${bolt(68,29,1.35)}${bolt(48,67,1.2)}
    ${line("M40 40q3-6 9-6", "#edfaff",.9)}
  </g>
  </g></g>
  <g data-component="revocation-interlock">
  ${plate("M14 75 29 68 63 77 71 83 62 91 28 86 14 82Z","dark-metal")}
  ${fork(18,68,-56,secondary)}${line("M35 76l19 6", "#09202d",4)}
  ${line("M36 75l19 6",accent,1.3)}${bolt(61,84,1.6)}</g>`;
}
