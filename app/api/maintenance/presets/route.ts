import { maintenanceAccess } from '../../../../lib/maintenance';
import { PROFILE_IDS } from '../../../../lib/state';
import { readProfile } from '../../../../lib/cloud-store';
export async function POST(request: Request) {
  if (!maintenanceAccess(request)) return Response.json({ error: 'Accès refusé.' }, { status: 403 });
  await Promise.all(PROFILE_IDS.map(readProfile));
  return Response.json({ ok: true, initialized: PROFILE_IDS, version: 1 }, { headers: { 'Cache-Control': 'no-store' } });
}
