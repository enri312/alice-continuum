import { plate, line, pin, bolt } from "../shared/instrument.mjs";

export default function body(accent, secondary) {
  return `<g data-component="kinematic-bench">
    ${plate("M13 77l26-10 42 7 7 6-32 13-42-8Z","dark-metal")}
    ${line("M18 82l36 7 25-10",accent,1.2)}
    ${plate("M13 70V26l12-8 4 3-9 9v39Z","metal")}
    ${line("M20 34l6-5m-6 12 4-3m-4 11 5-4m-5 12 4-3", "#9bb7c8",.95)}
  </g>
  <g data-part="articulated-rig">
    ${line("M17 80h16m28 0h20M20 77V39M78 75V35","#435e73",1)}
    ${plate("M36 33 44 27 57 26 64 32 56 46 47 49 39 44Z","glass",accent)}
    ${plate("M43 49 56 46 60 51 54 57 43 59 39 54Z")}
    ${line("M40 33L28 44 19 39M59 32L71 45 82 37M45 56L37 69 31 82M54 54L64 64 70 80","#1a2b39",6.7)}
    ${line("M40 32L28 43 19 38M59 31L71 44 82 36M45 55L37 68 31 81M54 53L64 63 70 79","#acc1ca",3.2)}
    ${plate("M45 12l8-2 6 5-1 7-5 4-7-3-3-6Z","metal")}
    ${line("M47 17l9-1",accent,1.8)}
    ${[[28,43],[71,44],[37,68],[64,63],[45,55],[54,53]].map(([x,y])=>pin(x,y,2.7,accent)).join("")}
    ${line("M24 83l8-1m36-1 9 1",secondary,3)}
  <g data-component="limb-housings">
    ${plate("M34 37l4-4 3 2-6 6-3 1Z","dark-metal")}
    ${plate("M62 36l3-2 5 6-2 4Z","metal")}
    ${plate("M37 73l-3 8-5 1 4-11Z","metal")}
    ${plate("M64 69l4-3 5 11-2 3Z","dark-metal")}
    ${line("M42 33l8 3 8-5m-10 6-3 7m8-7 2 5",secondary,1.2)}
    ${bolt(46,46,1.1)}${bolt(56,46,1.1)}
  </g>
  </g>`;
}
