import { plate, line, pin, bolt, coupling, conduit } from "../shared/instrument.mjs";

export default function capabilities(accent, secondary) {
  return `<g data-component="bus-connectors">
    ${plate("M10 29 21 22V71L10 76 7 71Z","dark-metal")}
    ${[32,43,54,65].map(y=>line(`M10 ${y}l7-4`,secondary,1.6)).join("")}
    ${conduit("M77 29h8l4 5v23l-6 7h-6",accent)}
    ${coupling(87,44,90,accent)}
  </g>
  <g data-part="domain-backplane">
    ${plate("M16 25 62 14 83 25V74L38 86 15 74Z")}
    ${plate("M21 29 62 20 78 28V69L38 79 21 70Z","dark-metal")}
    ${line("M29 58l18-4V36l16-4M47 54l18-4M47 54v10l16-4","#7392aa",1.5)}
    ${[[30,39],[46,35],[63,31],[30,52],[63,45],[30,65],[63,59]].map(([x,y],i)=>`<g transform="translate(${x} ${y})">
      ${plate("M-5-4l9-2 3 2v7l-10 2-2-2Z","glass")}${line("M-2 0l5-1",i%3===0?secondary:accent,1.7)}</g>`).join("")}
    ${pin(75,70,1.4,accent)}
  <g data-component="address-lines">
    ${line("M24 32l9-2 4-5 22-5m-34 42 13 4 5-3m6-17 9-2 3-4m-16 24 2 4 10-3","#7ca4b3",.9)}
    ${bolt(19,27)}${bolt(38,79)}${bolt(77,26)}
  </g>
  </g>`;
}
