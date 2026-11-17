import { plate, line, pin, bolt } from "../shared/instrument.mjs";

export default function memory(accent, secondary) {
  return `<g data-component="retrieval-bus">
    ${plate("M10 61 18 56 90 45 93 51V70L57 91 11 77Z","dark-metal")}
    ${line("M58 86l30-17",secondary,1.4)}${bolt(89,53)}
  </g>
  <g data-part="indexed-memory">
    ${plate("M12 32 36 20 51 24 60 19 86 29V64L56 79 12 63Z","metal")}
    ${[0,7,14].map((offset,i)=>`<g transform="translate(${offset*.45} ${offset})">
      ${plate("M20 34 41 24 69 29 72 33V49L43 61 20 54Z",i===2?"glass":"dark-metal")}
      ${line("M24 36l18-8 16 3",i===2?secondary:accent,1.5)}</g>`).join("")}
    ${plate("M11 47 43 57 50 52 58 54 84 43V70L53 87 12 73Z","dark-metal")}
    ${plate("M13 49 43 59 49 55 55 57V82L15 70Z","metal")}
    ${line("M19 65l16 5","#152c41",2.7)}${line("M59 64l18-9M59 69l10-5",accent,1.7)}
    ${pin(48,74,1.8,secondary)}
  <g data-component="archive-reader">
    ${plate("M17 59l23 7v10l-23-7Z","dark-metal")}
    ${line("M20 63l14 4m-14-1 11 3",accent,1)}
    ${plate("M61 54l12-6 4 2v6l-13 7-3-2Z","metal")}
    ${line("M67 56l6-3",secondary,1.6)}
    ${line("M27 46l13 5 17-7m-24-2 9 3 14-6", "#c8e0f1",.95)}
    ${bolt(48,64,1.1)}${bolt(80,65,1.2)}
  </g>
  </g>`;
}
