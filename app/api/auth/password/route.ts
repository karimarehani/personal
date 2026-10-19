import { loginPassword } from '../../../../lib/password-auth';
import { sameOrigin } from '../../../../lib/phone-auth';
import { isProfileId } from '../../../../lib/state';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origine refusée.' }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new Error('Demande de connexion invalide.');
    const body = JSON.parse(raw) as { profileId: string; password: string };
    if (!isProfileId(body.profileId)) throw new Error('Session inconnue.');
    const session = await loginPassword(request, body.profileId, body.password);
    return Response.json({ verified: true, profileId: session.profileId, admin: session.admin }, { headers: { 'Set-Cookie': session.cookie, 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Connexion impossible.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
}
