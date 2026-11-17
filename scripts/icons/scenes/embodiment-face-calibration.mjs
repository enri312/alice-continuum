import { plate, line, pin, dial, bolt } from "../shared/instrument.mjs";

export default function face(accent, secondary) {
  return `<g data-component="calibration-yoke">
    ${plate("M10 36 13 22 24 15 31 17 20 26 18 49 23 68 37 78 32 86 18 79 11 62Z","dark-metal")}
    ${plate("M76 18l9 3 6 12-1 25-6 19-12 8-5-6 12-12 5-17-1-18Z","dark-metal")}
    ${dial(15,50,5)}${dial(85,50,5)}${bolt(24,77)}${bolt(79,74)}
  </g>
  <g data-part="landmark-mask">
    ${line("M14 32V21L28 17M72 17L85 21V32M14 65V77L26 81M74 81L85 77V65","#728c9f",3)}
    ${plate("M50 12Q73 13 75 35L70 61Q64 74 52 82H47Q33 75 27 60L23 35Q23 15 50 12Z","metal")}
    ${plate("M28 36Q49 26 70 36L67 47 58 52 49 47 39 52 30 47Z","dark-metal")}
    ${line("M33 42l9-3M56 39l10 3",accent,2.6)}
    ${line("M49 44l-4 14 6 2M39 67q10 4 19-1", "#294055",1.6)}
    ${line("M32 46L35 58 47 72 62 60 66 46M35 58l13 3 14-1","#537581",1)}
    ${[[32,46],[35,58],[47,72],[62,60],[66,46]].map(([x,y])=>pin(x,y,1.25,secondary)).join("")}
  <g data-component="facial-contours">
    ${line("M32 26q5-9 14-10m7 1q10 3 14 9M27 31l10-4 4-6m13 3 3 4 13 4", "#b5c7d5",.8)}
    ${line("M34 54l5 4 2 6m22-11-6 5-2 5m-14 8 7 4 6-3", "#52687b",1.1)}
    ${pin(29,39,1.15,accent)}${pin(69,38,1.15,accent)}
  </g>
  </g>`;
}
