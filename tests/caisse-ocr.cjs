// Real neural OCR on a synthetic receipt. No browser, external API or personal data.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { createWorker } = require('tesseract.js');
const root = path.resolve(__dirname, '..'), folder = path.join(root, '.sites-runtime/caisse-ocr');
fs.mkdirSync(folder, { recursive: true });
const image = path.join(folder, 'synthetic-receipt.png');
execFileSync('python3', ['-c', `from PIL import Image, ImageDraw, ImageFont
import sys
im=Image.new('RGB',(1200,750),'white'); d=ImageDraw.Draw(im)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',42)
for i,line in enumerate(['PAPETERIE DU CENTRE','Date : 18/10/2026','Papier A4        100,00','Stylos            20,00','TOTAL HT         120,00','TVA               24,00','TOTAL TTC        144,00 DH']):
 d.text((65,40+i*88),line,font=font,fill='black')
im.save(sys.argv[1])`, image]);
(async () => {
 const worker = await createWorker(['fra', 'eng', 'ara'], 1, { langPath: path.join(root, 'public/caisse-v1/lang'), cacheMethod: 'none' });
 try {
  const { data } = await worker.recognize(image);
  const { caisseRecognizeText } = await import('../ui/caisse-model.js');
  const r = caisseRecognizeText(data.text, { mode: 'ticket', date: '2026-10-19' });
  assert.equal(r.rows.length, 1); assert.equal(r.rows[0].montantCts, 14400); assert.equal(r.rows[0].date, '2026-10-18'); assert.equal(r.rows[0].categorie, 'fourniture');
  console.log('PASS real multilingual OCR → one expense, 144.00 DH, 18/10/2026, Achat fourniture');
 } finally { await worker.terminate(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
