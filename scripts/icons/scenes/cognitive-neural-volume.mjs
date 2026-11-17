import { reel, tube } from "../shared/workshop-parts.mjs";
import { plate, line, pin, bolt, coupling } from "../shared/instrument.mjs";

export default function neuralVolume(accent, secondary) {
  return `${tube("M18 58Q-2 36 18 20Q41 2 69 11Q92 18 92 42",secondary)}
  ${line("M12 42Q10 21 32 14m47 4q11 7 11 19","#a4d5ee",1)}
  <g transform="translate(6 -1) scale(.89)"><g data-component="tomography-cradle">
    ${plate("M12 52 15 48 20 52 25 70 42 79 62 79 78 68 84 48 90 51 85 73 68 87 40 90 19 76Z","metal")}
    ${line("M18 57l6 16 17 11 23-1 17-13",accent,1.5)}
    ${coupling(50,86,-5,secondary)}${bolt(17,55)}${bolt(85,55)}
  </g>
  <g data-part="cerebral-hemispheres">
    ${plate("M46 17C43 9 32 10 28 18 18 17 12 25 14 33 5 37 7 49 13 54 9 64 17 71 25 72 27 81 39 84 46 76Z","glass",accent)}
    ${plate("M53 16C59 9 69 11 72 19 82 18 88 25 86 34 94 40 91 50 87 55 91 65 80 73 75 73 71 83 60 84 53 75Z","dark-metal",secondary)}
    ${line("M18 34Q27 34 25 26M15 52Q22 46 29 51M28 72Q26 62 35 60M45 26Q36 23 35 32M16 60Q24 57 25 61",accent,1.45)}
    ${line("M56 26Q65 24 67 31M72 21Q70 34 79 34M84 52Q75 49 76 43M72 71Q78 64 70 59M55 67Q62 66 64 59",secondary,1.6)}
    ${line("M22 40L35 33 41 46 31 56 39 68M41 46L57 44 67 33 79 40M57 44L67 56 79 56M67 56L61 70", "#c5f2ff",1.1)}
    ${[[22,40],[35,33],[41,46],[31,56],[39,68],[57,44],[67,33],[79,40],[67,56],[79,56],[61,70]].map(([x,y])=>pin(x,y,1.65,x<50?accent:secondary)).join("")}
    ${line("M47 80Q50 85 48 90L53 88 57 79","#7d9cb7",2)}
  <g data-component="cortical-fibers">
    ${line("M19 27q8 4 13-3t10 1m-22 19q6-8 12-4t7-4M17 57q6-6 12-3m1 11q-3-7 5-11M33 73q4-12 9-13M57 18q8 1 8 8m7 9q7-4 10 0m-24 6q9-5 15 1m-5 9q10-1 13 6m-16 6q4 7 11 5", "#a3bcdc",.85)}
    ${line("M24 49l-7-5m9-6-2-8M37 46l-5-3m6 5-3 5M64 54l-6-3m8 6-3 5M78 54l7-6",secondary,1)}
    ${[[18,43],[24,30],[32,43],[58,51],[63,62],[85,48]].map(([x,y])=>pin(x,y,1,x<50?accent:secondary)).join("")}
  </g>
  </g></g>
  <g data-component="tomography-gantry">
  ${plate("M8 65 14 59 20 63 24 77 40 84 60 84 78 73 83 58 90 57 93 63 85 82 65 93H35L14 83Z","dark-metal")}
  ${tube("M14 70 19 80 38 89 60 89 80 78 87 63",accent)}${reel(15,68,6.2,accent)}${reel(86,62,6,secondary)}
  ${line("M37 85h8m8 0h7",secondary,1.4)}</g>`;
}
