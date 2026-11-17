import { reel, readout, tube } from "../shared/workshop-parts.mjs";
import { plate, line, pin, dial, bolt, coupling, conduit } from "../shared/instrument.mjs";

export default function conversation(accent, secondary) {
  return `${tube("M12 69Q2 83 15 86L42 91 58 82",secondary)}
  <g transform="translate(2 -5) scale(.95)"><g data-component="audio-circuit">
    ${conduit("M26 61v12l9 6h13",accent)}
    ${coupling(37,79,0,accent)}
    ${plate("M43 70l19-2 8 6-2 9-20 2-7-5Z","dark-metal")}
    ${[0,1,2,3,4].map(i=>line(`M${48+i*3} 74l-2 6`,secondary,1.1)).join("")}
  </g>
  <g data-part="reply">
    ${plate("M45 41H79Q88 41 88 49V67Q88 74 80 74H76L77 84 62 74H45Q39 74 39 67V49Q39 41 45 41Z","glass",secondary)}
    ${line("M57 58H80M61 63H74",secondary,1.8)}
  </g>
  <g data-part="dialogue">
    ${plate("M19 19H61Q70 19 70 28V52Q70 60 61 60H41L23 72 25 60H19Q12 60 12 52V28Q12 19 19 19Z")}
    ${plate("M21 24H60Q65 24 65 30V50Q65 55 59 55H37L29 61 30 55H21Q17 55 17 50V30Q17 24 21 24Z","dark-metal")}
    ${line("M24 39H28L32 33 36 46 41 29 46 48 51 36 55 40H59",accent,2.7)}
    ${line("M22 27H43","#effaff",.9)}
    ${pin(61,21,1,accent)}
  <g data-component="acoustic-transducer">
    ${plate("M13 23l7-6h24l5 3H27l-3 4Z","dark-metal")}
    ${line("M23 49h9m2 0h3m19-17h4","#83acc2",.8)}
    ${[0,1,2,3,4].map(i=>line(`M${25+i*5} 52v-2`,"#52738e",.65)).join("")}
    ${plate("M71 47 82 44 88 48V62L76 67 71 63Z","dark-metal")}
    ${dial(80,55,6)}${pin(80,55,2.5,secondary)}
    ${bolt(16,24,1.1)}${bolt(66,54,1.1)}
  </g>
  </g></g>
  <g data-component="duplex-console" transform="rotate(-5 48 77)">
  ${plate("M12 69 21 64 62 69 74 74 70 86 56 91 18 85 12 80Z","metal")}
  ${readout(19,69,35,14,"M4 9h5l2-4 3 6 4-8 2 7 3-2h5",accent)}
  ${reel(62,78,7.4,secondary)}${line("M18 81l28 4",accent,1.2)}</g>`;
}
