/**
 * The starter quiz's pictures, drawn as SVG and rendered to WebP when the quiz is added, so the
 * app ships no photos and calls no outside service. No words in them: one drawing serves both languages.
 */

const ink = '#2b2b2b'

// A cow facing right, about 210 × 150 around its middle.
const cow = `
<g id="cow">
  <path d="M-68 -8 C-90 10 -88 40 -80 52" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>
  <circle cx="-80" cy="56" r="7" fill="${ink}"/>
  <rect x="-52" y="15" width="16" height="55" rx="6" fill="#fff" stroke="${ink}" stroke-width="4"/>
  <rect x="-24" y="15" width="16" height="55" rx="6" fill="#fff" stroke="${ink}" stroke-width="4"/>
  <rect x="18" y="15" width="16" height="55" rx="6" fill="#fff" stroke="${ink}" stroke-width="4"/>
  <rect x="44" y="15" width="16" height="55" rx="6" fill="#fff" stroke="${ink}" stroke-width="4"/>
  <ellipse cx="0" cy="0" rx="75" ry="40" fill="#fff" stroke="${ink}" stroke-width="4"/>
  <ellipse cx="-30" cy="-8" rx="20" ry="15" fill="${ink}"/>
  <ellipse cx="18" cy="14" rx="15" ry="10" fill="${ink}"/>
  <ellipse cx="40" cy="-20" rx="10" ry="8" fill="${ink}"/>
  <path d="M72 -54 l-6 -16 M94 -56 l6 -16" stroke="#e8d9a8" stroke-width="7" stroke-linecap="round"/>
  <ellipse cx="62" cy="-42" rx="12" ry="7" fill="#fff" stroke="${ink}" stroke-width="4"/>
  <ellipse cx="85" cy="-30" rx="28" ry="25" fill="#fff" stroke="${ink}" stroke-width="4"/>
  <ellipse cx="100" cy="-16" rx="21" ry="14" fill="#f6a5b4" stroke="${ink}" stroke-width="4"/>
  <circle cx="93" cy="-17" r="3" fill="${ink}"/>
  <circle cx="106" cy="-17" r="3" fill="${ink}"/>
  <circle cx="80" cy="-38" r="4.5" fill="${ink}"/>
</g>`

const place = (x: number, y: number, scale: number, flip = false) =>
  `<use href="#cow" transform="translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})"/>`

/** Seven cows: five in front, one small far up the hill, one hiding behind a bush with only its head out. */
const cows = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
<defs>${cow}
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#dff3ff"/></linearGradient>
</defs>
<rect width="960" height="640" fill="url(#sky)"/>
<circle cx="830" cy="90" r="50" fill="#ffd84d"/>
<path d="M0 300 C200 220 420 250 620 200 C760 170 880 190 960 210 L960 640 L0 640 Z" fill="#7cc95a"/>
<path d="M0 420 C240 380 600 400 960 360 L960 640 L0 640 Z" fill="#5fb143"/>
${place(700, 215, 0.28)}
<rect x="808" y="210" width="22" height="130" fill="#8a5a2b"/>
<circle cx="820" cy="190" r="70" fill="#3f9a37"/>
${place(395, 330, 0.6, true)}
${place(118, 300, 0.75)}
<ellipse cx="92" cy="330" rx="105" ry="55" fill="#3f9a37"/>
<ellipse cx="40" cy="315" rx="55" ry="40" fill="#46a83d"/>
${place(150, 470, 1)}
${place(440, 505, 1.05, true)}
${place(600, 440, 0.9)}
${place(810, 520, 1)}
</svg>`

/** A goldfish in a bowl, looking puzzled. */
const goldfish = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
<rect width="960" height="640" fill="#fff4dc"/>
<rect x="250" y="520" width="460" height="40" rx="12" fill="#c98b4f"/>
<path d="M330 150 C220 230 220 450 330 520 L630 520 C740 450 740 230 630 150 Z" fill="#cdeeff" stroke="${ink}" stroke-width="6"/>
<path d="M262 260 C300 245 360 270 480 255 C600 240 660 270 698 260 L700 300 C720 380 700 470 630 520 L330 520 C260 470 240 380 262 260 Z" fill="#7cc8f2"/>
<g transform="translate(470 380)">
  <path d="M-80 0 L-140 -45 L-130 0 L-140 45 Z" fill="#ff8a2a" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/>
  <ellipse cx="0" cy="0" rx="95" ry="58" fill="#ff9f3a" stroke="${ink}" stroke-width="5"/>
  <path d="M-10 -55 C10 -95 50 -90 55 -45" fill="#ff8a2a" stroke="${ink}" stroke-width="5"/>
  <circle cx="45" cy="-12" r="16" fill="#fff" stroke="${ink}" stroke-width="4"/>
  <circle cx="50" cy="-12" r="7" fill="${ink}"/>
  <path d="M78 22 q8 -6 14 0" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>
</g>
<circle cx="600" cy="300" r="14" fill="none" stroke="#fff" stroke-width="5"/>
<circle cx="630" cy="250" r="9" fill="none" stroke="#fff" stroke-width="4"/>
<circle cx="610" cy="205" r="6" fill="none" stroke="#fff" stroke-width="4"/>
<path d="M700 70 C700 30 800 30 800 70 C800 100 770 105 760 125 L760 140" fill="none" stroke="${ink}" stroke-width="14" stroke-linecap="round"/>
<circle cx="760" cy="180" r="10" fill="${ink}"/>
</svg>`

const flag = (stripes: string[], vertical: boolean) => {
  const w = 600
  const h = 400
  const rects = stripes
    .map((fill, i) =>
      vertical
        ? `<rect x="${(i * w) / 3}" y="0" width="${w / 3 + 1}" height="${h}" fill="${fill}"/>`
        : `<rect x="0" y="${(i * h) / 3}" width="${w}" height="${h / 3 + 1}" fill="${fill}"/>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${rects}<rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="#d0d0d0" stroke-width="2"/></svg>`
}

/** A round's intro picture: a big symbol on a coloured tile with cow spots. */
const tile = (background: string, symbol: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
<rect width="960" height="640" fill="${background}"/>
<ellipse cx="120" cy="110" rx="90" ry="60" fill="#fff" opacity="0.18"/>
<ellipse cx="850" cy="540" rx="120" ry="75" fill="#fff" opacity="0.18"/>
<ellipse cx="840" cy="120" rx="50" ry="35" fill="#fff" opacity="0.18"/>
<ellipse cx="140" cy="540" rx="60" ry="40" fill="#fff" opacity="0.18"/>
${symbol}
</svg>`

const questionMark = `<path d="M390 240 C390 150 570 150 570 240 C570 300 480 300 480 370 L480 400" fill="none" stroke="#fff" stroke-width="56" stroke-linecap="round"/>
<circle cx="480" cy="480" r="34" fill="#fff"/>`
const lightning = `<path d="M530 110 L370 350 L480 350 L430 530 L600 280 L490 280 Z" fill="#fff" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/>`
const bubbles = `<rect x="250" y="150" width="300" height="190" rx="50" fill="#fff"/>
<path d="M320 330 L300 400 L380 335 Z" fill="#fff"/>
<rect x="430" y="270" width="290" height="180" rx="50" fill="#ffe7a8"/>
<path d="M640 440 L670 505 L590 445 Z" fill="#ffe7a8"/>
<circle cx="340" cy="245" r="16" fill="${ink}"/><circle cx="400" cy="245" r="16" fill="${ink}"/><circle cx="460" cy="245" r="16" fill="${ink}"/>`

export const starterDrawings = {
  cows,
  goldfish,
  hungary: flag(['#ce2939', '#ffffff', '#477050'], false),
  bulgaria: flag(['#ffffff', '#00966e', '#d62612'], false),
  italy: flag(['#009246', '#ffffff', '#ce2b37'], true),
  ireland: flag(['#169b62', '#ffffff', '#ff883e'], true),
  roundBrain: tile('#7a31ca', questionMark),
  roundFast: tile('#f9a825', lightning),
  roundYou: tile('#1957d2', bubbles),
} as const

export type StarterDrawing = keyof typeof starterDrawings
