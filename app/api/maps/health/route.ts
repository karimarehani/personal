// Read-only diagnostics over fixed public coordinates; the Site remains owner-private.
// No profile records, phone numbers, credentials or user-provided places are returned.
import { roadDistance } from '../../../../lib/maps';
import { maintenanceAccess } from '../../../../lib/maintenance';
export async function GET(request: Request) {
  if (!maintenanceAccess(request)) return Response.json({ error: 'Accès refusé.' }, { status: 403 });
  const origin = { lat: 33.5927184, lon: -7.6232772 }, destination = { lat: 31.623871, lon: -8.014418 };
  try { return Response.json({ ok: true, route: await roadDistance(origin, destination) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Distance indisponible.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
