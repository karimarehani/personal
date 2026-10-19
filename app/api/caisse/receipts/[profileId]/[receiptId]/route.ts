import { env } from 'cloudflare:workers';
import { access, sameOrigin } from '../../../../../../lib/phone-auth';
import { isProfileId } from '../../../../../../lib/state';
import { registeredProfile } from '../../../../../../lib/accounts';
type Context = { params: Promise<{ profileId: string; receiptId: string }> };
const MAX_BYTES = 8 * 1024 * 1024;
async function authorize(request: Request, context: Context) {
  const auth = await access(request);
  if (!auth) return { error: Response.json({ error: 'Connexion requise.' }, { status: 401 }) };
  const { profileId, receiptId } = await context.params;
  if (!isProfileId(profileId) || !/^[a-f0-9]{64}$/.test(receiptId)) return { error: Response.json({ error: 'Justificatif inconnu.' }, { status: 404 }) };
  if (auth.profileId && auth.profileId !== profileId) return { error: Response.json({ error: 'Cette session ne vous appartient pas.' }, { status: 403 }) };
  if (!await registeredProfile(profileId)) return { error: Response.json({ error: 'Session inconnue.' }, { status: 404 }) };
  if (!env.BUCKET) return { error: Response.json({ error: 'Stockage des justificatifs indisponible. Vos lignes restent conservées.' }, { status: 503 }) };
  return { bucket: env.BUCKET, key: `caisse/${profileId}/${receiptId}`, receiptId };
}
export async function GET(request: Request, context: Context) {
  const a = await authorize(request, context); if (a.error) return a.error;
  const file = await a.bucket!.get(a.key!);
  if (!file) return Response.json({ error: 'Justificatif introuvable.' }, { status: 404 });
  const name = (file.customMetadata?.name || 'justificatif').replace(/[\r\n]/g, '');
  return new Response(file.body as unknown as BodyInit, { headers: {
    'Content-Type': file.httpMetadata?.contentType || 'application/octet-stream',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Content-Length': String(file.size), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'
  } });
}
export async function PUT(request: Request, context: Context) {
  const a = await authorize(request, context); if (a.error) return a.error;
  if (!sameOrigin(request)) return Response.json({ error: 'Origine refusée.' }, { status: 403 });
  const mime = (request.headers.get('content-type') || '').split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mime)) return Response.json({ error: 'Choisissez un PDF ou une image JPG, PNG ou WebP.' }, { status: 415 });
  if (Number(request.headers.get('content-length') || 0) > MAX_BYTES) return Response.json({ error: 'Le justificatif dépasse 8 Mo.' }, { status: 413 });
  let name = 'justificatif';
  try { name = decodeURIComponent(request.headers.get('x-file-name') || 'justificatif').replace(/[\r\n\\/]/g, '-').slice(0, 180) || name; } catch { return Response.json({ error: 'Nom du fichier invalide.' }, { status: 400 }); }
  const reader = request.body?.getReader(); if (!reader) return Response.json({ error: 'Fichier vide.' }, { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_BYTES) { await reader.cancel(); return Response.json({ error: 'Le justificatif dépasse 8 Mo.' }, { status: 413 }); } chunks.push(value); }
  if (!size) return Response.json({ error: 'Fichier vide.' }, { status: 400 });
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const matches = mime === 'application/pdf' ? ascii(0, 5) === '%PDF-' : mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : mime === 'image/png' ? bytes[0] === 137 && ascii(1, 4) === 'PNG' : ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  if (!matches) return Response.json({ error: 'Le contenu du fichier ne correspond pas à son format.' }, { status: 415 });
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
  if (digest !== a.receiptId) return Response.json({ error: 'Fichier modifié : relancez son import.' }, { status: 400 });
  try {
    const existing = await a.bucket!.head(a.key!);
    if (!existing) await a.bucket!.put(a.key!, bytes, { httpMetadata: { contentType: mime }, customMetadata: { name } });
    return Response.json({ id: a.receiptId, name, mime, size }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: 'Le justificatif n’a pas pu être conservé. Réessayez.' }, { status: 503 }); }
}
