import { normalizePhone, sameOrigin, sendCode } from '../../../../lib/phone-auth';
import { isProfileId } from '../../../../lib/state';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origine refusée.' }, { status: 403 });
  try { const body = await request.json() as { profileId: string; phone: string }; if (!isProfileId(body.profileId)) throw new Error('Session inconnue.'); await sendCode(request, body.profileId, normalizePhone(body.phone)); return Response.json({ sent: true }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Envoi impossible.' }, { status: 400 }); }
}
