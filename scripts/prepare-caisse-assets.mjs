import { mkdir, copyFile, readdir, cp, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..'), out = join(root, 'public/caisse-v1');
await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'core'), { recursive: true });
await mkdir(join(out, 'lang'), { recursive: true });
const tess = dirname(require.resolve('tesseract.js/package.json'));
const tessRequire = createRequire(join(tess, 'package.json'));
const core = dirname(tessRequire.resolve('tesseract.js-core/package.json'));
for (const f of ['tesseract.min.js', 'worker.min.js', 'tesseract.min.js.LICENSE.txt', 'worker.min.js.LICENSE.txt']) await copyFile(join(tess, 'dist', f), join(out, f));
for (const f of await readdir(core)) if (/^tesseract-core.*\.(?:wasm|js)$/.test(f)) await copyFile(join(core, f), join(out, 'core', f));
for (const lang of ['fra', 'eng', 'ara']) {
  const data = dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`));
  await copyFile(join(data, '4.0.0_best_int', `${lang}.traineddata.gz`), join(out, 'lang', `${lang}.traineddata.gz`));
}
const pdf = dirname(require.resolve('pdfjs-dist/package.json'));
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) await copyFile(join(pdf, 'legacy/build', f), join(out, f));
for (const dir of ['cmaps', 'standard_fonts', 'wasm']) await cp(join(pdf, dir), join(out, dir), { recursive: true });
await copyFile(join(tess, 'LICENSE.md'), join(out, 'TESSERACT-LICENSE.md'));
await copyFile(join(pdf, 'LICENSE'), join(out, 'PDFJS-LICENSE'));
console.log('Caisse: OCR, PDF reader and language models prepared locally.');
