import { bolt, coupling, dial, line, pin, plate } from "../shared/instrument.mjs";
import { precisionControlRim } from "../shared/component-panel-finish.mjs";

function bearing(id, accent, secondary) {
  return `<g transform="scale(.5)">${precisionControlRim(id, accent, secondary)}</g>`;
}

function lensMount(x, y, radius, accent) {
  return [45, 135, 225, 315].map(angle => `<g transform="translate(${x} ${y}) rotate(${angle})">
    ${plate(`M-6 -${radius-2}v-5l2-2h8l2 2v5Z`, "dark-metal")}
    ${line(`M-3 -${radius+5}h6`, accent, 1)}
    ${bolt(0,-radius-2,1.05)}</g>`).join("");
}

function lens(closer, accent, secondary) {
  return `<g data-part="${closer ? "magnify" : "reduce"}">
    ${plate("M55 61 62 55 85 75Q89 80 83 85 79 89 75 85Z")}
    ${line("M69 67l-3 4m7 0-3 4m7 0-3 4","#4e697c",1.7)}
    ${lensMount(41,41,27,accent)}${dial(41,41,27)}${bearing(closer ? "zoom-in" : "zoom-out", accent, secondary)}
    ${line("M29 41H53", "#0b1723",6)}${line("M29 41H53","#e5fbff",3.7)}
    ${closer ? line("M41 29V53","#e5fbff",3.7) : ""}
    ${line("M25 32q5-9 16-10",accent,1.4)}
    ${coupling(74,74,44,secondary)}
  </g>`;
}
export const cameraScenes = {
  "zoom-in": (accent, secondary) => lens(true, accent, secondary),
  "zoom-out": (accent, secondary) => lens(false, accent, secondary),
  pan(accent, secondary) {
    return `<g data-part="four-directions">
      ${lensMount(50,50,31,secondary)}${dial(50,50,31)}${bearing("pan",accent,secondary)}
      ${[0,90,180,270].map(angle=>`<g transform="rotate(${angle} 50 50)">
        ${plate("M47 40V28H42L50 18 58 28H53V40Z","enamel")}
        ${line("M48 31h4m-4 3h4m-4 3h4","#346480",.85)}
      </g>`).join("")}${pin(50,50,4.5,secondary)}</g>`;
  },
  rotate(accent, secondary) {
    return `<g data-part="orbit-pivot">
      ${dial(50,50,31)}${bearing("rotate",accent,secondary)}
      ${plate("M38 43 50 36 62 43V56L50 63 38 56Z","glass")}
      ${line("M39 43l11 6 11-6m-11 6v13","#e5f7fd",1.4)}
      ${line("M26 38Q13 42 12 51C10 64 32 69 57 63S93 45 86 40",accent,3)}
      ${plate("M79 34l11 2-1 10Z","enamel")}
      ${coupling(22,60,24,secondary)}${pin(50,49,1.65,accent)}
    </g>`;
  },
  reset(accent, secondary) {
    return `<g data-part="return-home">
      ${lensMount(50,50,32,secondary)}${dial(50,50,32)}${bearing("reset",accent,secondary)}
      ${line("M69 52a20 20 0 1 1-11-20",accent,3.2)}
      ${plate("M54 24l10 9-11 4Z","enamel")}
      ${plate("M38 53 50 42 63 53H59V63H44V53Z","metal")}
      ${line("M49 62v-7h5v7","#203346",1.8)}
      ${line("M32 69l8 3m20 0 8-4","#98adbf",1.35)}${pin(50,74,1.45,secondary)}
    </g>`;
  },
};
