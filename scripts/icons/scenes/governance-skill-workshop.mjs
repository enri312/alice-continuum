import { plate, line, pin, bolt, coupling, conduit } from "../shared/instrument.mjs";

export default function skills(accent, secondary) {
  return `<g data-component="workbench-vise">
    ${plate("M11 57l8-4 11 3v11l-7 4-12-4Z","metal")}
    ${conduit("M78 66h9l5-6v-5",secondary)}
    ${coupling(82,64,-17,secondary)}
  </g>
  <g data-part="draft-workbench">
    ${plate("M12 64 46 50 85 61V73L52 87 12 76Z","dark-metal")}
    ${plate("M12 63 46 48 85 59 52 75Z")}
    ${line("M20 72l24 8m14-3 19-8",accent,1.6)}
    ${plate("M22 41 44 31 65 39V52L43 63 22 55Z","glass",accent)}
    ${line("M27 44l16 6 16-7M43 50v9","#c9f1ff",1.25)}
    ${plate("M52 15Q58 9 65 13L58 19 62 24 69 18Q72 27 62 32L44 50Q40 54 36 50L34 48Q33 45 37 42L53 26Q48 21 52 15Z","metal")}
    ${pin(39,47,1.5,secondary)}
  <g data-component="prototype-jig">
    ${plate("M15 53l7-3 6 2v12l-5 3-8-3Z","dark-metal")}
    ${plate("M62 49l7-4 6 3v10l-9 5-4-2Z","metal")}
    ${coupling(70,62,-18,accent)}
    ${line("M26 43l7-3m-6 10 5 2m15-4 8-4m-8 8 5-2",secondary,1.05)}
    ${bolt(17,69,1.3)}${bolt(50,81,1.5)}
  </g>
  </g>`;
}
