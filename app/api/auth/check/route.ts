import { normalizePhone, sameOrigin, checkCode } from '../../../../lib/phone-auth';
import { isProfileId } from '../../../../lib/state';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origine refusée.' }, { status: 403 });
  try { const body = await request.json() as { profileId: string; phone: string; code: string }; if (!isProfileId(body.profileId)) throw new Error('Session inconnue.'); const cookie = await checkCode(request, body.profileId, normalizePhone(body.phone), String(body.code)); return Response.json({ verified: true, profileId: body.profileId }, { headers: { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Vérification impossible.' }, { status: 400 }); }
}
