import { access, sameOrigin } from '../../../../lib/phone-auth';
import { roadDistance } from '../../../../lib/maps';
export async function POST(request: Request) {
  if (!await access(request)) return Response.json({ error: 'Connexion requise.' }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: 'Origine refusée.' }, { status: 403 });
  try { const b = await request.json() as { origin: {lat:number;lon:number}; destination: {lat:number;lon:number} }; return Response.json(await roadDistance(b.origin, b.destination), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Distance indisponible.' }, { status: 400 }); }
}
