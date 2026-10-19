import { phoneSession, smsConfigured, smsRequired } from '../../../../lib/phone-auth';
import { passwordConfigured, passwordRequired, passwordSession } from '../../../../lib/password-auth';
import { listAccounts } from '../../../../lib/accounts';
export async function GET(request: Request) {
  const passwords = passwordRequired(), session = passwords ? await passwordSession(request) : null;
  const accounts = (await listAccounts()).map(({ id, nom, poste, civ }) => ({ id, nom, poste, civ }));
  return Response.json({ accounts, required: !passwords && smsRequired(), configured: smsConfigured(), passwordRequired: passwords, passwordConfigured: passwordConfigured(), profileId: passwords ? session?.profileId || null : await phoneSession(request), admin: session?.admin || false }, { headers: { 'Cache-Control': 'no-store' } });
}
