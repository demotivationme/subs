// Generates the catalog logo tiles from Simple Icons (CC0).
// Usage (outside the repo, e.g. in a scratch folder with `npm i simple-icons@15`):
//   NODE_PATH=<scratch>/node_modules node generate.mjs
// The PHP app never runs Node; the generated SVGs are committed.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.NODE_PATH ? process.env.NODE_PATH + '/x.js' : import.meta.url);
const icons = require('simple-icons');
const out = dirname(fileURLToPath(import.meta.url));
mkdirSync(out, { recursive: true });

// catalog slug => Simple Icons slug. Services absent here keep the letter tile.
const MAP = {
  netflix: 'netflix', 'youtube-premium': 'youtube', 'apple-tv': 'appletv', 'paramount': 'paramountplus',
  crunchyroll: 'crunchyroll', dazn: 'dazn', mubi: 'mubi', max: 'max',
  spotify: 'spotify', 'apple-music': 'applemusic', 'youtube-music': 'youtubemusic', tidal: 'tidal',
  'soundcloud-go': 'soundcloud', 'playstation-plus': 'playstation', 'ea-play': 'ea', 'ubisoft': 'ubisoft',
  'apple-arcade': 'applearcade', 'geforce-now': 'nvidia', 'icloud': 'icloud', dropbox: 'dropbox',
  '1password': '1password', nordvpn: 'nordvpn', 'chatgpt-plus': 'openai', 'claude-pro': 'claude',
  notion: 'notion', 'github-copilot': 'githubcopilot', 'canva-pro': 'canva',
  'the-new-york-times': 'newyorktimes', 'the-washington-post': 'thewashingtonpost', medium: 'medium',
  audible: 'audible', scribd: 'scribd', strava: 'strava', peloton: 'peloton', headspace: 'headspace',
  'fitbit-premium': 'fitbit', 'duolingo-super': 'duolingo', 'coursera-plus': 'coursera',
  skillshare: 'skillshare', 'uber-one': 'uber', 'doordash-dashpass': 'doordash', 'instacart': 'instacart',
  patreon: 'patreon', 'twitch-turbo': 'twitch',
};

// Design tile colors (docs/design/canvas/ServiceIcon.dc.html): [background, glyph, ring]
const DESIGN = {
  netflix: ['#000000', '#E50914'], spotify: ['#191414', '#1ED760'],
  'youtube-premium': ['#FFFFFF', '#FF0000', true], icloud: ['#3693F3', '#FFFFFF'],
  'apple-music': ['#FA243C', '#FFFFFF'], max: ['#0A0A0A', '#FFFFFF'],
  'playstation-plus': ['#0070D1', '#FFFFFF'], dropbox: ['#FFFFFF', '#0061FF', true],
  audible: ['#F8991C', '#FFFFFF'],
  dazn: ['#000000', '#FFFFFF'], // brand hex is near-white; a light glyph on white would vanish
};

const n = (v) => +v.toFixed(2);
const SIZE = 96, GLYPH = 0.56, RING = '#E3E6EA';

function luminance(hex) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colors(slug, brandHex) {
  if (DESIGN[slug]) return DESIGN[slug];
  const brand = '#' + brandHex.toUpperCase();
  return luminance(brandHex) > 0.7 ? ['#FFFFFF', brand, true] : [brand, '#FFFFFF'];
}

for (const [slug, siSlug] of Object.entries(MAP)) {
  const key = 'si' + siSlug[0].toUpperCase() + siSlug.slice(1);
  const icon = icons[key];
  if (!icon) throw new Error(`Simple Icons has no ${siSlug}`);
  const [bg, fg, ring] = colors(slug, icon.hex);
  const g = SIZE * GLYPH, offset = (SIZE - g) / 2;
  const rect = ring
    ? `<rect x="0.5" y="0.5" width="${SIZE - 1}" height="${SIZE - 1}" rx="${n(SIZE * 0.3)}" fill="${bg}" stroke="${RING}"/>`
    : `<rect width="${SIZE}" height="${SIZE}" rx="${n(SIZE * 0.3)}" fill="${bg}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`
    + rect
    + `<path transform="translate(${n(offset)} ${n(offset)}) scale(${g / 24})" fill="${fg}" d="${icon.path}"/></svg>\n`;
  writeFileSync(`${out}/${slug}.svg`, svg);
}
console.log(`wrote ${Object.keys(MAP).length} tiles`);
