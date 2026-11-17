import { plate, line, pin, bolt, coupling, conduit } from "../shared/instrument.mjs";

export default function procedures(accent, secondary) {
  return `<g data-component="read-head">
    ${plate("M12 34l6-5 6 2v44l-8 5-5-4Z","dark-metal")}
    ${conduit("M74 28h8l5 6v8",secondary)}
    ${coupling(16,48,90,accent)}
  </g>
  <g data-part="repeated-sequence">
    ${plate("M18 25 62 15 80 23V65L33 79 17 70Z","dark-metal")}
    ${plate("M17 34 62 23 78 30V72L32 86 17 78Z")}
    ${plate("M23 39 69 28V69L23 81Z","dark-metal")}
    ${[0,12,24].map((dy,i)=>`<g transform="translate(0 ${dy})">${line("M29 44l13-3 5 2 12-3",i===1?secondary:accent,1.9)}
      ${pin(29,44,1.6,accent)}${pin(57,40,1.5,secondary)}</g>`).join("")}
    ${line("M74 38q13 1 12 14-1 8-9 12m0-5-1 6 6 1",secondary,2.6)}
  <g data-component="trace-banks">
    ${[0,12,24].map(y=>line(`M27 ${48+y}l31-7m1 0 6-2`,"#6c8f9f",.8)).join("")}
    ${line("M31 32l12-3m5-2 9-2",accent,1.4)}
    ${bolt(20,37,1.4)}${bolt(70,70,1.35)}${bolt(24,77,1)}
  </g>
  </g>`;
}
