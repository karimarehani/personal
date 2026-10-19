import { access, sameOrigin } from '../../../../lib/phone-auth';
import { resolveMaps } from '../../../../lib/maps';
export async function POST(request: Request) {
  if (!await access(request)) return Response.json({ error: 'Connexion requise.' }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: 'Origine refusée.' }, { status: 403 });
  try { const body = await request.json() as { url: string }; if (typeof body.url !== 'string' || body.url.length > 8000) throw new Error('Lien invalide.'); return Response.json(await resolveMaps(body.url), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Lieu introuvable.' }, { status: 400 }); }
}
