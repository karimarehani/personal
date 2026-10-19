import { access } from '../../../lib/phone-auth';
import { listAccounts } from '../../../lib/accounts';
import { readProfile } from '../../../lib/cloud-store';
export async function GET(request: Request) {
  const auth = await access(request);
  if (!auth) return Response.json({ error: 'Connexion requise.' }, { status: 401 });
  try { return Response.json({ profiles: await Promise.all((auth.profileId ? [auth.profileId] : (await listAccounts()).map(a => a.id)).map(readProfile)) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'Impossible de charger les données du serveur.' }, { status: 503 }); }
}
