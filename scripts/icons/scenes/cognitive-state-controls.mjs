import { plate, line, pin, bolt, coupling, conduit } from "../shared/instrument.mjs";

export default function stateControls(accent, secondary) {
  return `<g data-component="signal-input">
    ${conduit("M18 48h-5l-4 5v15l6 5h11",accent)}
    ${coupling(12,58,90,secondary)}
  </g>
  <g data-part="session-faders">
    ${plate("M18 19 67 13 84 23V76L77 83 25 89 16 81V26Z")}
    ${plate("M22 25 72 19 78 24V75L72 78 22 84Z","dark-metal")}
    ${[32,49,66].map((x,i)=>{const y=[49,60,39][i];return `<g transform="translate(${x} 0)">
      ${line("M0 32V72","#07121d",5)}${line("M0 33V71","#829eaf",1)}
      ${line("M-7 34v34","#647c90",.7)}<path d="M-7 34v33" fill="none" stroke="#bdcfda" stroke-width="2.6" stroke-dasharray="1 5"/>
      ${plate(`M-6 ${y-3}l12-1 1 2v5l-13 1Z`,"metal")}
      ${line(`M-4 ${y+1}l8-.6`,i===1?secondary:accent,2)}
    </g>`}).join("")}
    ${pin(22,22,1,accent)}${pin(77,78,1,accent)}
  <g data-component="meter-bank">
    ${plate("M24 24 65 19 70 20V26L24 32Z","glass")}
    ${line("M27 28l7-1 2-2 3 2 3-4 2 2 5-1 4-2 2 2 9-2",accent,1.15)}
    ${plate("M28 77 69 72V76L28 82Z","dark-metal")}
    ${[32,40,48,56,64].map(x=>line(`M${x} ${80-x*.11}l3-.5`,x<49?accent:"#8e9fae",1.3)).join("")}
    ${line("M79 32v33m2-30v22","#102535",1.1)}
    ${bolt(74,21,1.4)}${bolt(23,81,1.4)}
  </g>
  </g>`;
}
