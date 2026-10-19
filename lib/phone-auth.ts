import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { isProfileId, type ProfileId } from './state';
import { passwordRequired, passwordSession } from './password-auth';
type SmsEnv = { SMS_PROVIDER?: string; DESCOPE_PROJECT_ID?: string; TWILIO_ACCOUNT_SID?: string; TWILIO_AUTH_TOKEN?: string; TWILIO_VERIFY_SERVICE_SID?: string; AUTH_PHONES_JSON?: string; REQUIRE_SMS_OTP?: string };
const config = () => env as typeof env & SmsEnv;
export function normalizePhone(value: string): string {
  const cleaned = String(value || '').replace(/[\s().-]/g, '');
  const phone = /^0[67]\d{8}$/.test(cleaned) ? '+212' + cleaned.slice(1) : cleaned.startsWith('00') ? '+' + cleaned.slice(2) : cleaned;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Indiquez un numéro valide avec son indicatif, par exemple +212.');
  return phone;
}
function phones(): Partial<Record<ProfileId, string>> {
  try { const raw = JSON.parse(config().AUTH_PHONES_JSON || '{}'); const out: Partial<Record<ProfileId, string>> = {}; for (const [id, value] of Object.entries(raw)) if (isProfileId(id) && typeof value === 'string') out[id] = normalizePhone(value); return out; } catch { return {}; }
}
export function smsConfigured() { const c = config(), p = phones(); const provider = c.SMS_PROVIDER === 'descope' ? c.DESCOPE_PROJECT_ID : c.TWILIO_ACCOUNT_SID && c.TWILIO_AUTH_TOKEN && c.TWILIO_VERIFY_SERVICE_SID; return !!(provider && p.karima && p.wijdane && p.samir && new Set(Object.values(p)).size === Object.values(p).length); }
async function descope(path: string, body: Record<string, string>) {
  const r = await fetch('https://api.descope.com/v1/auth/otp/' + path + '/sms', { method: 'POST', headers: { Authorization: 'Bearer ' + config().DESCOPE_PROJECT_ID, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const j = await r.json() as { sessionJwt?: string; user?: { phone?: string } };
  if (!r.ok) throw new Error(path === 'verify' ? 'Code invalide ou expiré.' : 'Le SMS n’a pas pu être envoyé. Vérifiez le service SMS ou son quota gratuit.');
  return j;
}
async function monthlyFreeLimit() {
  const now = Date.now(), period = new Date().toISOString().slice(0, 7), key = 'descope-free:' + period;
  const row = await env.DB!.prepare('INSERT INTO otp_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(key, now + 40 * 86400000).first<{ count: number }>();
  if (!row || row.count > 100) throw new Error('Le quota de 100 demandes SMS du mois est atteint. Aucun envoi payant ne sera effectué par cet outil.');
}
export function smsRequired() { return config().REQUIRE_SMS_OTP === '1'; }
function allowed(profileId: ProfileId, phone: string) { const known = phones()[profileId]; if (!known || known !== phone) throw new Error('Ce numéro n’est pas autorisé pour cette session.'); }
const COOKIE = '__Host-bluechili-session';
const hash = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
const cookieValue = (request: Request) => (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) || '';
export async function phoneSession(request: Request): Promise<ProfileId | null> {
  const token = cookieValue(request); if (!/^[a-f0-9]{64}$/.test(token) || !env.DB) return null;
  const row = await env.DB.prepare('SELECT profile_id FROM phone_sessions WHERE token_hash = ? AND expires_at > ?').bind(await hash(token), Date.now()).first<{ profile_id: string }>();
  return row && isProfileId(row.profile_id) ? row.profile_id : null;
}
export async function access(request: Request) {
  if (passwordRequired()) { const session = await passwordSession(request); return session ? { profileId: session.admin ? null : session.profileId } : null; }
  if (smsRequired()) { const id = await phoneSession(request); return id ? { profileId: id } : null; }
  return await getChatGPTUser() ? { profileId: null } : null;
}
export function sameOrigin(request: Request) { const origin = request.headers.get('origin'); return !origin || origin === new URL(request.url).origin; }
async function limit(request: Request, id: ProfileId, purpose: string, max: number, seconds: number) {
  if (!env.DB) throw new Error('Service de connexion indisponible.');
  const now = Date.now(), bucket = Math.floor(now / (seconds * 1000));
  const key = `${purpose}:${id}:${bucket}`;
  const row = await env.DB.prepare('INSERT INTO otp_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(key, now + seconds * 1000).first<{ count: number }>();
  if (!row || row.count > max) throw new Error('Trop de tentatives. Patientez quelques minutes puis réessayez.');
}
async function provider(path: string, body: Record<string, string>) {
  const c = config();
  const result = await fetch(`https://verify.twilio.com/v2/Services/${c.TWILIO_VERIFY_SERVICE_SID}/${path}`, { method: 'POST', headers: { Authorization: 'Basic ' + btoa(`${c.TWILIO_ACCOUNT_SID}:${c.TWILIO_AUTH_TOKEN}`), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body), signal: AbortSignal.timeout(15000) });
  const json = await result.json() as { status?: string };
  if (!result.ok) throw new Error(path === 'Verifications' ? 'Le SMS n’a pas pu être envoyé. Réessayez plus tard.' : 'Code invalide ou expiré.');
  return json;
}
export async function sendCode(request: Request, id: ProfileId, phone: string) {
  if (!smsConfigured()) throw new Error('La connexion SMS est préparée mais son service d’envoi n’est pas encore activé.');
  allowed(id, phone); await limit(request, id, 'send-minute', 1, 60); await limit(request, id, 'send-hour', 8, 3600);
  if (config().SMS_PROVIDER === 'descope') { await monthlyFreeLimit(); await descope('signup-in', { loginId: phone }); } else await provider('Verifications', { To: phone, Channel: 'sms' });
}
export async function checkCode(request: Request, id: ProfileId, phone: string, code: string) {
  if (!smsConfigured()) throw new Error('Le service SMS n’est pas encore activé.');
  allowed(id, phone); if (!/^\d{4,10}$/.test(code)) throw new Error('Saisissez le code reçu par SMS.');
  await limit(request, id, 'check', 8, 600);
  if (config().SMS_PROVIDER === 'descope') { const result = await descope('verify', { loginId: phone, code }); if (!result.sessionJwt || result.user?.phone && normalizePhone(result.user.phone) !== phone) throw new Error('Code invalide ou expiré.'); } else { const result = await provider('VerificationCheck', { To: phone, Code: code }); if (result.status !== 'approved') throw new Error('Code invalide ou expiré.'); }
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join('');
  await env.DB!.prepare('INSERT INTO phone_sessions (token_hash, profile_id, expires_at) VALUES (?, ?, ?)').bind(await hash(token), id, Date.now() + 24 * 3600 * 1000).run();
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`;
}
export async function logout(request: Request) { const token = cookieValue(request); if (token && env.DB) await env.DB.prepare('DELETE FROM phone_sessions WHERE token_hash = ?').bind(await hash(token)).run(); return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`; }
