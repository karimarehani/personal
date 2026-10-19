import { logout, sameOrigin } from '../../../../lib/phone-auth';
import { logoutPassword } from '../../../../lib/password-auth';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({}, { status: 403 });
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', await logout(request));
  headers.append('Set-Cookie', await logoutPassword(request));
  return Response.json({ loggedOut: true }, { headers });
}
