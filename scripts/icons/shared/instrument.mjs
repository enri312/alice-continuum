// Las escenas se dibujan sobre una mesa de 100 unidades. Las superficies comparten
// la luz superior izquierda y el espesor inferior, aunque cada silueta es propia.
export function plate(d, material = "metal", edge = "#a8c3d1") {
  return `<path d="${d}" transform="translate(.8 3)" fill="#0a1424" stroke="#173044" stroke-width="1.8"/>
    <path d="${d}" transform="translate(.4 1.65)" fill="#25364b" stroke="url(#bevel)" stroke-width="1.45"/>
    <path d="${d}" fill="url(#${material})" stroke="url(#bevel)" stroke-width="1.55"/>
    <path d="${d}" fill="url(#brushing)" stroke="${edge}" stroke-opacity=".66" stroke-width=".45"/>`;
}
export function line(d, ink = "#d3e7f3", width = 1.3) {
  return `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${width}"/>`;
}
export function pin(x, y, r = 2, ink = "#b9eaff") {
  return `<circle cx="${x}" cy="${y}" r="${r + 1}" fill="#08131f" stroke="#718ba0" stroke-width=".75"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/><circle cx="${x - r * .28}" cy="${y - r * .32}" r="${r * .28}" fill="#fff"/>`;
}
export function dial(x, y, r) {
  return `<circle cx="${x}" cy="${y + 1.4}" r="${r + 1}" fill="#050e18"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="url(#metal)" stroke="#c2d7e0" stroke-width=".8"/>
    <circle cx="${x}" cy="${y}" r="${r * .78}" fill="url(#glass)" stroke="#162c40" stroke-width="1.2"/>
    <path d="M${x-r*.64} ${y-r*.32}Q${x-r*.47} ${y-r*.78} ${x+r*.18} ${y-r*.69}" fill="none" stroke="#e4f6ff" stroke-opacity=".75" stroke-width="${r*.048}"/>
    <path d="M${x-r*.13} ${y+r*.67}Q${x+r*.42} ${y+r*.68} ${x+r*.66} ${y+r*.2}" fill="none" stroke="#86cbe0" stroke-opacity=".65" stroke-width="${r*.03}"/>
    <circle cx="${x}" cy="${y}" r="${r * .87}" fill="none" stroke="#d7e5ea" stroke-width=".65" stroke-dasharray="1 3"/>`;
}
// Subconjuntos mecánicos compartidos. Las escenas eligen sus posiciones y escala.
export function bolt(x, y, r = 1.55) {
  return `<g transform="translate(${x} ${y}) scale(${r})"><circle r="1.55" fill="#06101b" stroke="#8198a9" stroke-width=".28"/>
    <circle r="1.13" fill="url(#bevel)" stroke="#cad9e4" stroke-width=".13"/>
    <path d="M-.62-.38 0-.72 .62-.38 .62.38 0 .72-.62.38Z" fill="#101d2b"/>
    <path d="M-.78-.53Q-.3-1 .4-.92" stroke="white" stroke-width=".16" fill="none"/></g>`;
}

// Empuñaduras y racores con las estrías orientadas a lo largo de la pieza.
export function coupling(x, y, angle, accent) {
  return `<g transform="translate(${x} ${y}) rotate(${angle})">
    ${plate("M-6-3h12l2 2v3l-2 2H-6l-2-2v-3Z", "dark-metal")}
    ${line("M-4-3v6m2-6v6m2-6v6m2-6v6m2-6v6","#bcced9",.75)}
    ${line("M-6-2v4m12-4v4",accent,1.3)}</g>`;
}

export function conduit(d, accent) {
  return `<g>${line(d,"#050c16",3.8)}${line(d,"#637f96",2.4)}
    ${line(d,accent,1.1)}<path d="${d}" fill="none" stroke="#e0f8ff" stroke-width=".6" stroke-dasharray="2 5"/></g>`;
}

export function instrument({ id, title, semantic, accent, secondary, art }) {
  const prefix = `alice-${id}-`;
  const motion = art.includes('class="instrument-light"');
  const mark = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" role="img" aria-label="${title}" data-icon="${id}" data-semantic="${semantic}" data-visual-style="titanio-optico" data-motion="${motion ? "indicator" : "static"}">
  <title>${title}</title>
  ${motion ? `<style>@media(prefers-reduced-motion:no-preference){[data-icon="${id}"] .instrument-light{animation:${prefix}glint 7s ease-in-out infinite}}@keyframes ${prefix}glint{0%,45%,100%{opacity:1}70%{opacity:.55}}</style>` : ""}
  <defs>
    <linearGradient id="rotor" x2=".86" y2="1"><stop stop-color="#edf8ff"/><stop offset=".21" stop-color="#6f8a9d"/><stop offset=".43" stop-color="#25374c"/><stop offset=".48" stop-color="#aec6d1"/><stop offset=".7" stop-color="#536d82"/><stop offset="1" stop-color="#1d3043"/></linearGradient>
    <linearGradient id="contact" x2=".15" y2="1"><stop stop-color="#ffe2aa"/><stop offset=".26" stop-color="#cf955c"/><stop offset=".59" stop-color="#875838"/><stop offset=".81" stop-color="#eeb377"/><stop offset="1" stop-color="#603e2e"/></linearGradient>
    <pattern id="brushing" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><path d="M0 .4h3" stroke="#d1e6fa" opacity=".10" stroke-width=".32"/><path d="M0 2h3" stroke="#020913" opacity=".20" stroke-width=".38"/></pattern>
    <linearGradient id="bevel" x1="0" y1="0" x2=".68" y2="1"><stop stop-color="#e9f8ff"/><stop offset=".27" stop-color="#7d98b0"/><stop offset=".48" stop-color="#192c48"/><stop offset=".53" stop-color="#d0e7fa"/><stop offset=".73" stop-color="#53758b"/><stop offset="1" stop-color="#23384b"/></linearGradient>
    <linearGradient id="metal" x1="0" y1="0" x2=".62" y2="1"><stop stop-color="#d9e5f0"/><stop offset=".19" stop-color="#7895ac"/><stop offset=".44" stop-color="#39536b"/><stop offset=".48" stop-color="#172c43"/><stop offset=".84" stop-color="#516b84"/><stop offset="1" stop-color="#263d50"/></linearGradient>
    <linearGradient id="dark-metal" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="#506b80"/><stop offset=".23" stop-color="#2a4257"/><stop offset=".58" stop-color="#15293d"/><stop offset="1" stop-color="#081728"/></linearGradient>
    <linearGradient id="glass" x1=".06" y1="0" x2=".84" y2="1"><stop stop-color="${accent}"/><stop offset=".23" stop-color="${accent}" stop-opacity=".65"/><stop offset=".48" stop-color="#214260"/><stop offset=".8" stop-color="#0b2035"/><stop offset="1" stop-color="${secondary}"/></linearGradient>
    <linearGradient id="enamel" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#eeffff"/><stop offset=".2" stop-color="${accent}"/><stop offset=".7" stop-color="${accent}"/><stop offset="1" stop-color="${secondary}"/></linearGradient>
    <linearGradient id="screw-metal"><stop stop-color="#4a6277"/><stop offset=".43" stop-color="#d7e5eb"/><stop offset="1" stop-color="#42556b"/></linearGradient>
  </defs>
  <g transform="scale(2)" stroke-linecap="round" stroke-linejoin="round">${art}</g>
</svg>\n`;
  // Los SVG también se insertan en línea dentro de una misma vista.
  return mark.replace(/^[ \t]+$/gm, "").replaceAll('id="', `id="${prefix}`).replaceAll("url(#", `url(#${prefix}`);
}
