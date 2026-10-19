import { access } from '../../../../lib/phone-auth';
import { isProfileId, validateState } from '../../../../lib/state';
import { saveProfile } from '../../../../lib/cloud-store';
import { registeredProfile } from '../../../../lib/accounts';
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const auth = await access(request);
  if (!auth) return Response.json({ error: 'Connexion requise.' }, { status: 401 });
  const { id } = await context.params;
  if (!isProfileId(id)) return Response.json({ error: 'Session inconnue.' }, { status: 404 });
  if (auth.profileId && auth.profileId !== id) return Response.json({ error: 'Cette session ne vous appartient pas.' }, { status: 403 });
  if (!await registeredProfile(id)) return Response.json({ error: 'Session inconnue.' }, { status: 404 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Origine refusée.' }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 2_000_000) return Response.json({ error: 'Sauvegarde trop volumineuse.' }, { status: 413 });
  let state;
  try { state = validateState(JSON.parse(raw), id); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Données invalides.' }, { status: 400 }); }
  try { return Response.json(await saveProfile(id, state), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'Sauvegarde impossible. Vos données restent conservées sur cet appareil.' }, { status: 503 }); }
}
