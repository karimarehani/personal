import { access, sameOrigin } from '../../../../lib/phone-auth';
import { searchMapPlaces, reverseMapPlace, validCoords } from '../../../../lib/maps';
export async function POST(request: Request) {
  if (!await access(request)) return Response.json({ error: 'Connexion requise.' }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: 'Origine refusée.' }, { status: 403 });
  try {
    const b = await request.json() as { query?: string; lat?: number; lon?: number; bias?: {lat:number;lon:number} };
    if (b.query !== undefined) {
      if (typeof b.query !== 'string' || b.bias && !validCoords(b.bias.lat, b.bias.lon)) throw new Error('Nom ou coordonnées invalides.');
      return Response.json({ features: await searchMapPlaces(b.query, b.bias) });
    }
    return Response.json({ feature: await reverseMapPlace(b.lat!, b.lon!) });
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : 'Lieu introuvable.' }, { status: 400 }); }
}
