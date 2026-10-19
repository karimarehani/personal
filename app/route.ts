import html from '../ui/tool.html?raw';
import congesModel from '../ui/conges-model.js?raw';
import caisseModel from '../ui/caisse-model.js?raw';
import caisseUI from '../ui/caisse-ui.js?raw';
import repasModel from '../ui/repas-model.js?raw';
import repasUI from '../ui/repas-ui.js?raw';
import letterheadsModel from '../ui/letterheads-model.js?raw';
import letterheadsAssets from '../ui/letterheads-assets.js?raw';
import adminUI from '../ui/admin-ui.js?raw';
import mobileUI from '../ui/mobile-ui.js?raw';
export async function GET() {
  const page = html.replace('/*__CONGES_MODEL__*/', () => congesModel.replace(/^export /gm, ''))
    .replace('/*__CAISSE_MODEL__*/', () => caisseModel.replace(/^export /gm, ''))
    .replace('/*__CAISSE_UI__*/', () => caisseUI)
    .replace('/*__REPAS_MODEL__*/', () => repasModel.replace(/^export /gm, ''))
    .replace('/*__REPAS_UI__*/', () => repasUI)
    .replace('/*__LETTERHEADS_MODEL__*/', () => letterheadsModel.replace(/^export /gm, ''))
    .replace('/*__LETTERHEADS_ASSETS__*/', () => letterheadsAssets.replace(/^export /gm, ''))
    .replace('/*__ADMIN_UI__*/', () => adminUI)
    .replace('/*__MOBILE_UI__*/', () => mobileUI);
  return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } });
}
