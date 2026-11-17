#!/usr/bin/env node
// Turns PRIVACY.md into a small static site (privacy/index.html) for the store listings.
//   node scripts/build-privacy-page.mjs --check       fail if [bracketed] blanks remain
//   node scripts/build-privacy-page.mjs --out _site   write the page (also fails on blanks)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outDir = outIndex >= 0 ? args[outIndex + 1] : null;

const source = readFileSync(join(root, 'PRIVACY.md'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');

// A blank is [text] that is not a Markdown link: [text](url).
const blanks = [...source.matchAll(/\[([^\]\n]+)\](?!\()/g)].map(m => m[0]);
if (blanks.length) {
  console.error(`PRIVACY.md still has blanks to fill in: ${blanks.join(', ')}`);
  process.exit(1);
}
if (!outDir) {
  console.log('PRIVACY.md has no blanks.');
  process.exit(0);
}

const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s =>
  escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((https?:[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2">$1</a>');

export function render(markdown) {
  const html = [];
  let paragraph = [];
  let list = [];
  const flush = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.join(' '))}</p>`);
    if (list.length) html.push(`<ul>${list.map(i => `<li>${inline(i)}</li>`).join('')}</ul>`);
    paragraph = [];
    list = [];
  };
  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
    } else if (/^- /.test(line)) {
      if (paragraph.length) flush();
      list.push(line.slice(2));
    } else if (/^\s{2,}\S/.test(raw) && list.length) {
      list[list.length - 1] += ` ${line.trim()}`;
    } else if (!line.trim()) {
      flush();
    } else {
      if (list.length) flush();
      // Two trailing spaces or consecutive bold "Label:" lines keep their line break.
      paragraph.push(/^\*\*[^*]+:\*\*/.test(line) && paragraph.length ? `<br>${line}` : line);
    }
  }
  flush();
  return html.join('\n').replace(/&lt;br&gt;/g, '<br>');
}

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Forward privacy policy</title>
<style>
  body { font: 17px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; color: #15151c; background: #fff; margin: 0; }
  main { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
  h1 { font-size: 1.9rem; line-height: 1.2; } h2 { font-size: 1.25rem; margin-top: 2rem; }
  a { color: #5b4fd6; } code { background: #f0f0f5; padding: 0 .3em; border-radius: 4px; }
  @media (prefers-color-scheme: dark) { body { color: #ececf3; background: #0b0b12; } a { color: #a79cff; } code { background: #1c1c28; } }
</style>
</head>
<body><main>
${render(source)}
</main></body>
</html>
`;

mkdirSync(join(outDir, 'privacy'), { recursive: true });
writeFileSync(join(outDir, 'privacy', 'index.html'), page);
writeFileSync(join(outDir, 'index.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=privacy/"><title>Forward</title><a href="privacy/">Forward privacy policy</a>\n');
console.log(`Wrote ${join(outDir, 'privacy', 'index.html')}`);
