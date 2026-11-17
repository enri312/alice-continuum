import { plate, line, pin, dial, bolt } from "../shared/instrument.mjs";

export default function activity(accent, secondary) {
  return `<g data-component="chart-recorder">
    ${plate("M9 36 17 22 72 12 80 18 83 39 74 48 25 60 11 52Z","dark-metal")}
    ${line("M15 49l7 5 49-11",secondary,1.45)}
    ${bolt(16,45)}${bolt(76,20)}
  </g>
  <g data-part="event-spool">
    ${plate("M16 25 62 15 79 23V48L33 61 16 52Z","dark-metal")}
    ${dial(24,37,8)}${dial(70,28,7)}
    ${plate("M28 34 68 25Q72 25 72 31L70 46Q69 55 74 63L84 73 41 85 31 74Q24 66 26 55L29 41Z","metal")}
    ${line("M34 42l31-7M32 49l32-8M44 78l31-9","#587387",.85)}
    ${line("M31 61l9-2 4-7 6 13 6-21 6 12 9-3","#204053",4)}
    ${line("M31 60l9-2 4-7 6 13 6-21 6 12 9-3",accent,2)}
    ${[0,1,2,3,4].map(i=>line(`M${43+i*7} ${81-i*1.8}v1.4`,"#d5e8f5",.9)).join("")}
    <g class="instrument-light">${pin(70,30,1.7,secondary)}</g>
  <g data-component="stylus">
    ${pin(72,39,3,secondary)}
    ${line("M72 39L60 49l1.2 4","#0b1624",3.6)}${line("M72 38L60 48l1 4","#acc6d4",1.7)}
    ${line("M39 37l24-6m-26 12 24-6m-26 13 25-6m-22 25 30-8","#6c8d9e",.7)}
    ${line("M37 73l6 6 33-9", "#e0eaf1",.8)}
  </g>
  </g>`;
}
