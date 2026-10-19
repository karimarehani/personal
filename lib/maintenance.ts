import { env } from 'cloudflare:workers';
export function maintenanceAccess(request: Request) {
  const token = (env as typeof env & { BLUE_CHILI_MAINTENANCE_TOKEN?: string }).BLUE_CHILI_MAINTENANCE_TOKEN;
  return !!token && request.headers.get('Authorization') === 'Bearer ' + token;
}
