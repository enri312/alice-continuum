// Piezas en coordenadas del instrumento. El acento distingue el circuito de la carcasa.
import { bolt, line, plate } from "./instrument.mjs";

export function reel(x, y, radius, ink) {
  return `<g transform="translate(${x} ${y}) scale(${radius / 10})">
    <circle cy="1.1" r="10.2" fill="#061321" stroke="#617991"/>
    <circle r="9.5" fill="url(#rotor)" stroke="#d4e3ef" stroke-width=".75"/>
    ${[0,72,144,216,288].map(angle => `<g transform="rotate(${angle})">
      <path d="M-3-6.2Q-.5-8.6 2.8-6.4L1-3.8Q-.8-3.1-2.2-4.1Z" fill="#0a1625" stroke="#7f99a7" stroke-width=".45"/>
      <path d="M-1.6-8.1L1.5-8.2" fill="none" stroke="${ink}" stroke-width="1.05"/></g>`).join("")}
    ${bolt(0,0,1.9)}</g>`;
}

export function readout(x, y, width, height, trace, ink) {
  return `<g transform="translate(${x} ${y}) scale(${width / 34} ${height / 17})">
    ${plate("M2 0H31L34 3V14L31 17H2L0 15V2Z","dark-metal")}
    <path d="M3 3H30V13H3Z" fill="#081a29" stroke="#588793" stroke-width=".65"/>
    <path d="M3 7h27m-27 4h27m-22-8v10m6-10v10m6-10v10m6-10v10" stroke="#2d4d61" stroke-width=".45"/>
    ${line(trace,ink,1.6)}${line("M4 3.2h11","#c6f7ff",.55)}
    </g>`;
}

export function contactRail(x, y, count, angle, ink) {
  const width = count * 3 + 4;
  return `<g transform="translate(${x} ${y}) rotate(${angle})">
    ${plate(`M0 1 2-1H${width}V6H0Z`,"dark-metal")}
    ${Array.from({length:count},(_,i)=>`<path d="M${3+i*3} 0v4" stroke="url(#contact)" stroke-width="1.7"/>`).join("")}
    ${line(`M2 6h${width-4}`,ink,.85)}</g>`;
}

export function fork(x, y, angle, ink) {
  return `<g transform="translate(${x} ${y}) rotate(${angle})">
    ${plate("M0 1 4-3 7-2V9L11 15 15 14V2L20-1 23 2V19L13 27 1 18Z","metal")}
    ${line("M3 4v11l9 8 7-5v-8",ink,1.5)}${bolt(12,18,1.8)}</g>`;
}

export function tube(d, ink) {
  return `<g fill="none">${line(d,"#07101c",4.4)}${line(d,"url(#contact)",2.8)}
    ${line(d,ink,1.1)}<path d="${d}" stroke="#f7fbff" stroke-width=".65" stroke-dasharray="1.8 4"/></g>`;
}
