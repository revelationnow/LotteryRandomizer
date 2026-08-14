/**
 * Build a single self-contained page with the whole app and its draw history
 * inlined — no external requests at all.
 *
 * Emits two things from one build:
 *   dist-standalone/orrery.html   a complete page you can open from the filesystem
 *   dist-standalone/fragment.html style + markup + script only, for hosts that
 *                                 supply their own document skeleton
 */

import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_IDS } from '../src/lib/games.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = resolve(ROOT, 'dist-standalone');
const TMP = resolve(ROOT, '.vite-standalone');

function readData() {
  const dir = resolve(ROOT, 'public/data');
  const snapshots: Record<string, unknown> = {};
  for (const id of GAME_IDS) {
    snapshots[id] = JSON.parse(readFileSync(resolve(dir, `${id}.json`), 'utf8'));
  }
  const manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'));
  return { snapshots, manifest };
}

async function main() {
  rmSync(TMP, { recursive: true, force: true });

  await build({
    root: ROOT,
    // Relative base so the page works from a file:// path too.
    base: './',
    plugins: [react(), tailwindcss(), viteSingleFile()],
    build: {
      outDir: TMP,
      emptyOutDir: true,
      assetsInlineLimit: 100_000_000,
      cssCodeSplit: false,
      reportCompressedSize: false,
    },
    logLevel: 'warn',
  });

  let html = readFileSync(resolve(TMP, 'index.html'), 'utf8');

  // Inline the draw history ahead of the app bundle. </script> inside the JSON
  // would close the tag early, so escape it.
  const payload = JSON.stringify(readData()).replace(/<\/script/gi, '<\\/script');
  const dataTag = `<script>window.__ORRERY_DATA__=${payload};</script>`;
  html = html.replace(/<script type="module"/, `${dataTag}<script type="module"`);

  // The manifest and icon are separate files that do not exist in a single-file
  // build; drop the links rather than ship guaranteed 404s.
  html = html.replace(/\s*<link rel="(manifest|icon|apple-touch-icon)"[^>]*>/g, '');

  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, 'orrery.html'), html);

  // Fragment form. The single-file plugin inlines both the stylesheet and the app
  // bundle into <head>, so pull them out explicitly — styles ahead of the markup,
  // scripts after it, preserving their original order.
  const styles = [...html.matchAll(/<style[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
  const scripts = [...html.matchAll(/<script[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n');
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ?? '';

  if (!scripts) throw new Error('No inlined script found — the single-file build did not inline.');

  /*
   * Tailwind v4 emits everything inside @layer, and unlayered CSS beats layered CSS
   * in the cascade whatever the specificity. A host that injects its own unlayered
   * reset would therefore repaint the body over ours and leave pale text on a pale
   * ground. This unlayered guard restates the ground so the page holds up wherever
   * it is embedded.
   */
  const groundGuard = `<style>
  html { color-scheme: dark; }
  body { background: #05060f; color: #f4f4ff; margin: 0; }
</style>`;

  writeFileSync(
    resolve(OUT, 'fragment.html'),
    `<title>Orrery</title>\n${styles}\n${groundGuard}\n${body.trim()}\n${scripts}\n`,
  );

  rmSync(TMP, { recursive: true, force: true });

  const kb = (p: string) => Math.round(readFileSync(resolve(OUT, p)).byteLength / 1024);
  console.log(`orrery.html    ${kb('orrery.html')} KB`);
  console.log(`fragment.html  ${kb('fragment.html')} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
