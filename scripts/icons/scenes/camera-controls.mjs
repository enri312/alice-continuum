import { bolt, coupling, dial, line, pin, plate } from "../shared/instrument.mjs";
import { precisionControlRim } from "../shared/component-panel-finish.mjs";
import { contactRail, reel, tube } from "../shared/workshop-parts.mjs";

function bearing(id, accent, secondary) {
  return `<g transform="scale(.5)">${precisionControlRim(id, accent, secondary)}</g>`;
}

function lensMount(x, y, radius, accent) {
  return [45, 135, 225, 315].map(angle => `<g transform="translate(${x} ${y}) rotate(${angle})">
    ${plate(`M-6 -${radius-2}v-5l2-2h8l2 2v5Z`, "dark-metal")}
    ${line(`M-3 -${radius+5}h6`, accent, 0.8)}
    ${bolt(0,-radius-2,1.05)}</g>`).join("");
}

function lens(closer, accent, secondary) {
  const engraving = closer ? "M26 41H56M41 26V56" : "M26 41H56";
  return `<g data-part="${closer ? "magnify" : "reduce"}">
    ${plate("M55 61 62 55 85 75Q89 80 83 85 79 89 75 85Z")}
    ${line("M69 67l-3 4m7 0-3 4m7 0-3 4","#4e697c",1)}
    ${lensMount(41,41,27,accent)}${dial(41,41,27)}${bearing(closer ? "zoom-in" : "zoom-out", accent, secondary)}
    <g data-component="iris-blades" transform="translate(41 41)">
      ${[0,60,120,180,240,300].map(angle => `<path transform="rotate(${angle})" d="M-19-6Q-15-19-4-20L7-14-3-13-12-5Z" fill="url(#rotor)" stroke="#7ca2b2" stroke-width=".55"/>`).join("")}
    </g>
    <circle cx="41" cy="41" r="15.5" fill="#0c2032" stroke="#7995a8" stroke-width=".55"/>
    ${line(engraving,"#f2fcff",1.95)}
    ${line("M25 32q5-9 16-10",accent,1)}
    ${coupling(74,74,44,secondary)}
    ${contactRail(64,61,4,44,accent)}
  </g>`;
}
export const cameraScenes = {
  "zoom-in": (accent, secondary) => lens(true, accent, secondary),
  "zoom-out": (accent, secondary) => lens(false, accent, secondary),
  pan(accent, secondary) {
    return `<g data-part="four-directions">
      ${plate("M10 39 19 33 31 37 35 25 42 13 53 11 65 23 69 33 82 30 90 42V58L77 66 66 66 59 85 44 90 34 77 31 67 15 67 9 57Z","dark-metal")}
      ${line("M12 46v10l10 6m56-26 8 7v10",accent,1.15)}
      ${lensMount(50,50,31,secondary)}${dial(50,50,31)}${bearing("pan",accent,secondary)}
      ${[0,90,180,270].map(angle=>`<g transform="rotate(${angle} 50 50)">
        ${plate("M47 40V28H42L50 18 58 28H53V40Z","enamel")}
        ${line("M48 31h4m-4 3h4m-4 3h4","#346480",.85)}
      </g>`).join("")}${pin(50,50,4.5,secondary)}</g>`;
  },
  rotate(accent, secondary) {
    return `<g data-part="orbit-pivot">
      ${tube("M18 64Q6 45 28 25 52 5 74 19 93 32 83 49",secondary)}
      ${plate("M20 68 35 65 69 67 79 76 68 86 37 91 21 82Z","dark-metal")}
      ${reel(49,82,7,secondary)}
      ${dial(50,50,31)}${bearing("rotate",accent,secondary)}
      ${plate("M38 43 50 36 62 43V56L50 63 38 56Z","glass")}
      ${line("M39 43l11 6 11-6m-11 6v13","#e5f7fd",1)}
      ${line("M26 38Q13 42 12 51C10 64 32 69 57 63S93 45 86 40",accent,1.65)}
      ${plate("M79 34l11 2-1 10Z","enamel")}
      ${coupling(22,60,24,secondary)}${pin(50,49,1.65,accent)}
    </g>`;
  },
  reset(accent, secondary) {
    return `<g data-part="return-home">
      ${plate("M11 59 21 51 30 54 31 69 68 68 76 53 86 53 91 64 82 82 60 89 32 88 15 80Z","dark-metal")}
      ${contactRail(36,82,8,-2,secondary)}
      ${lensMount(50,50,32,secondary)}${dial(50,50,32)}${bearing("reset",accent,secondary)}
      ${line("M69 52a20 20 0 1 1-11-20",accent,1.65)}
      ${plate("M54 24l10 9-11 4Z","enamel")}
      ${plate("M38 53 50 42 63 53H59V63H44V53Z","metal")}
      ${line("M49 62v-7h5v7","#203346",1.15)}
      ${line("M32 69l8 3m20 0 8-4","#98adbf",0.9)}${pin(50,74,1.45,secondary)}
    </g>`;
  },
};
