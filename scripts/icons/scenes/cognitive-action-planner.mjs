import { contactRail, readout } from "../shared/workshop-parts.mjs";
import { plate, line, pin, dial, bolt, coupling } from "../shared/instrument.mjs";

export default function planner(accent, secondary) {
  return `${plate("M16 65 67 53 91 60V78L38 92 13 85Z","dark-metal")}
  <g transform="translate(0 -4) scale(.95)"><g data-component="binding">
    ${plate("M13 26 22 23 26 28V78L17 84 10 79Z","dark-metal")}
    ${[32,45,58,71].map(y=>coupling(18,y,-10,secondary)).join("")}
  </g>
  <g data-part="planned-route">
    ${plate("M21 16 61 11 75 22V81L25 88 17 80V22Z")}
    ${plate("M24 23 58 18 69 27V75L24 81Z","dark-metal")}
    ${plate("M32 14 51 11 52 17 32 20Z","metal")}
    ${line("M33 68V53L48 50V37L57 35",accent,1.35)}
    ${line("M33 53V38L40 37","#92a5b9",0.9)}
    ${pin(33,68,3,accent)}${pin(48,50,2,accent)}
    ${line("M57 40V28l9 2-9 5","#ffdc91",1.15)}
    ${plate("M58 64 73 52 89 61V75L74 87 58 78Z","glass",secondary)}
    ${dial(74,69,8)}${line("M74 64V70L78 71","#e8ffff",1)}
  <g data-component="planning-grid">
    ${line("M29 30l8-1m4-1 7-1M59 48v7l-5 2v8m-18 5 9-2 4-3", "#648599",.9)}
    ${[29,36,43].map(x=>line(`M${x} 74l4-.7`,"#9cb8cd",0.9)).join("")}
    ${bolt(64,26,1.3)}${bolt(26,77,1.3)}
    ${line("M65 74l4 3m11-14 3 3",secondary,0.8)}
  </g>
  </g></g>
  <g data-component="route-selector" transform="rotate(-10 65 78)">
  ${readout(48,70,39,19,"M4 11h6l4-6h5l4 5h6",accent)}
  ${contactRail(18,80,7,3,secondary)}</g>`;
}
