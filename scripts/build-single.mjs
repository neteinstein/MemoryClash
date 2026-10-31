// Gera dist-single/memoryclash.html: o jogo inteiro num só ficheiro HTML (JS, CSS, fonte e ícone embutidos).
// Útil para partilhar o jogo como um único ficheiro ou publicá-lo onde não se podem pôr vários ficheiros.
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'vite';

process.env.SINGLE_FILE = '1';
const out = 'dist-single';
await rm(out, { recursive: true, force: true });
await build({ logLevel: 'warn' });

let html = await readFile(join(out, 'index.html'), 'utf8');

html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/g, (_m, file) => '\u0000' + file);
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/g, (_m, file) => '\u0001' + file);

const parts = [];
for (const piece of html.split(/(\u0000[^\s<]+|\u0001[^\s<]+)/)) {
  if (piece.startsWith('\u0000')) {
    const js = await readFile(join(out, piece.slice(1)), 'utf8');
    parts.push(`<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
  } else if (piece.startsWith('\u0001')) {
    const css = await readFile(join(out, piece.slice(1)), 'utf8');
    parts.push(`<style>${css}</style>`);
  } else {
    parts.push(piece);
  }
}
html = parts.join('');

// Ícone embutido; o manifesto e o ícone para iOS precisam de ficheiros à parte, por isso saem.
const icon = await readFile('public/icon.svg', 'utf8');
html = html
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(icon)}" />`)
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '');

await writeFile(join(out, 'memoryclash.html'), html);
const leftovers = (await readdir(join(out, 'assets'))).filter((f) => !/\.(js|css)$/.test(f));
if (leftovers.length) throw new Error(`Recursos por embutir: ${leftovers.join(', ')}`);
console.log(`${out}/memoryclash.html (${Math.round(html.length / 1024)} KB)`);
