import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { caisseRecognizeText } from '../ui/caisse-model.js';
// Exercise the shipped digital PDF reader with local file URLs instead of HTTP assets.
const source = await readFile(new URL('../ui/caisse-ui.js', import.meta.url), 'utf8');
let fn = source.slice(source.indexOf('async function caissePDFText('), source.indexOf('\nasync function recognizeCaisse('));
for(const asset of ['pdf.min.mjs', 'pdf.worker.min.mjs', 'cmaps/', 'standard_fonts/', 'wasm/']) fn = fn.replace(`'/caisse-v1/${asset}'`, JSON.stringify(new URL('../public/caisse-v1/' + asset, import.meta.url).href));
const reader = eval('(' + fn + ')');
const bytes = await readFile(new URL('../.sites-runtime/test-pdfs/synthetic-receipt.pdf', import.meta.url));
const text = await reader({ arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }, () => { throw Error('Digital PDF unexpectedly needed OCR'); }, () => {});
const result = caisseRecognizeText(text, { mode: 'ticket', date: '2026-10-19' });
assert.equal(result.rows.length, 1); assert.equal(result.rows[0].montantCts, 14400); assert.equal(result.rows[0].date, '2026-10-18');
console.log('PASS shipped PDF reader → editable expense, 144.00 DH, 18/10/2026');
