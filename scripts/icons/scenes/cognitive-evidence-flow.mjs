import { readout, tube } from "../shared/workshop-parts.mjs";
import { plate, line, pin, bolt, coupling } from "../shared/instrument.mjs";

export default function evidenceFlow(accent, secondary) {
  return `${tube("M13 43 31 26 45 26 59 11 71 9",accent)}${tube("M12 55 18 70 33 78 49 78 61 86 80 84",secondary)}
  <g transform="translate(0 0) scale(.95)"><g data-component="signal-manifold">
    ${plate("M11 38l17-10 13 3 16-18 22-5 14 11v18l-15 9-13-2-10 11 13 4 9-8 17 8v22l-20 11-25-12-12-16-15 4-14-9Z","dark-metal")}
    ${line("M12 54l10 7 16-4 17 20 18 8 14-7M48 35l12-16 16-5", "#73899e",1.1)}
    ${bolt(13,42)}${bolt(90,76)}${bolt(84,14)}
  </g>
  <g data-part="branching-signal">
    ${line("M21 50H37L52 27H74M37 50L52 73H74","#27394e",9)}
    ${line("M21 48H36L51 25H74M36 48L51 71H74","#b6c6d4",4.7)}
    ${line("M21 48H36L51 25H74",accent,2.3)}
    ${line("M36 48L51 71H74",secondary,2.3)}
    ${plate("M7 43 15 35H27L34 42V54L27 61H15L7 54Z","glass",accent)}
    ${line("M14 48H25m-5-5 5 5-5 5","#e4fbff",2)}
    ${plate("M65 16 71 10H84L92 18V31L85 38H72L65 31Z","dark-metal",accent)}
    ${plate("M65 62 72 55H84L92 63V77L84 84H72L65 77Z","glass",secondary)}
    ${line("M71 24H85m-5-5 5 5-5 5",accent,2)}
    ${line("M72 67H84M72 72H81", "#fff2fc",2)}
    <g class="instrument-light">${pin(37,48,3.2,accent)}</g>
  <g data-component="signal-couplers">
    ${coupling(48,32,-56,accent)}${coupling(49,64,49,secondary)}
    ${line("M18 56h7m47-24h7m-5 45h9","#728da6",1.2)}
    ${line("M41 51l8 4 10 1m-15-8 9 4 8 1", "#81a9be",.8)}
  </g>
  </g></g>
  <g data-component="branch-analyzer">
  ${readout(10,69,33,17,"M4 11h5V7h6V4h6v5h8",accent)}
  ${plate("M47 83l9-4 9 5-8 6Z","metal")}${line("M51 84h8",secondary,1.4)}</g>`;
}
