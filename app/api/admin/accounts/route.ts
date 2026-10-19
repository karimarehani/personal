import { passwordRequired, passwordSession } from '../../../../lib/password-auth';
import { sameOrigin } from '../../../../lib/phone-auth';
import { AccountError, createAccount, listAccounts } from '../../../../lib/accounts';

const headers = { 'Cache-Control': 'private, no-store' };
async function authorize(request: Request) {
  const session = passwordRequired() ? await passwordSession(request) : null;
  if (!session) return Response.json({ error: 'Connexion requise.' }, { status: 401, headers });
  if (!session.admin) return Response.json({ error: 'Accès réservé à l’administratrice.' }, { status: 403, headers });
}
export async function GET(request: Request) {
  const denied = await authorize(request); if (denied) return denied;
  try { return Response.json({ accounts: await listAccounts() }, { headers }); }
  catch { return Response.json({ error: 'Impossible de charger l’équipe.' }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  const denied = await authorize(request); if (denied) return denied;
  if (!sameOrigin(request)) return Response.json({ error: 'Origine refusée.' }, { status: 403, headers });
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new AccountError('Demande trop volumineuse.', 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new AccountError('Compte invalide.'); }
    return Response.json(await createAccount(body), { status: 201, headers });
  } catch (error) {
    return Response.json({ error: error instanceof AccountError ? error.message : 'Création impossible. Réessayez.' }, { status: error instanceof AccountError ? error.status : 503, headers });
  }
}
