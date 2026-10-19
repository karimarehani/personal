import { env } from 'cloudflare:workers';
import { isProfileId, PROFILE_IDS, type ProfileId } from './state';
import { accountCredential } from './accounts';

type Credential = { salt: string; hash: string };
type PasswordEnv = { REQUIRE_PROFILE_PASSWORD?: string; AUTH_PASSWORD_HASHES_JSON?: string; AUTH_PASSWORD_HASH_AMINE_JSON?: string };
const config = () => env as typeof env & PasswordEnv;
const COOKIE = '__Host-bluechili-password';
const hex = (bytes: ArrayBuffer | Uint8Array) => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
const digest = async (value: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
const tokenOf = (request: Request) => (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) || '';

function credentials(): Partial<Record<ProfileId, Credential>> {
  try {
    const raw = JSON.parse(config().AUTH_PASSWORD_HASHES_JSON || '{}');
    if (config().AUTH_PASSWORD_HASH_AMINE_JSON) raw.amine = JSON.parse(config().AUTH_PASSWORD_HASH_AMINE_JSON!);
    const out: Partial<Record<ProfileId, Credential>> = {};
    for (const id of PROFILE_IDS) if (/^[a-f0-9]{32}$/.test(raw[id]?.salt) && /^[a-f0-9]{64}$/.test(raw[id]?.hash)) out[id] = { salt: raw[id].salt, hash: raw[id].hash };
    return out;
  } catch { return {}; }
}
export const passwordRequired = () => config().REQUIRE_PROFILE_PASSWORD !== '0';
export function passwordConfigured() { const c = credentials(); return PROFILE_IDS.every(id => !!c[id]) && new Set(Object.values(c).map(v => v!.hash)).size === PROFILE_IDS.length; }
const binding = (id: ProfileId, c: Credential) => `password:${id}:${c.salt}:${c.hash}`;

export async function passwordSession(request: Request): Promise<{ profileId: ProfileId; admin: boolean } | null> {
  const token = tokenOf(request);
  if (!/^[a-f0-9]{64}$/.test(token) || !env.DB) return null;
  const row = await env.DB.prepare('SELECT profile_id FROM phone_sessions WHERE token_hash = ? AND expires_at > ?').bind(await digest(token), Date.now()).first<{ profile_id: string }>();
  const id = row?.profile_id.split(':')[1] || '';
  if (!isProfileId(id)) return null;
  const c = credentials()[id] || await accountCredential(id);
  return c && row!.profile_id === binding(id, c) ? { profileId: id, admin: id === 'karima' } : null;
}

async function attemptLimit(request: Request, id: ProfileId) {
  if (!env.DB) throw new Error('Service de connexion indisponible.');
  const now = Date.now(), bucket = Math.floor(now / 600000);
  const limits: [string, number][] = [[`password-profile:${id}:${bucket}`, 12]];
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) limits.push([`password-ip:${await digest(ip)}:${bucket}`, 40]);
  for (const [key, max] of limits) {
    const row = await env.DB.prepare('INSERT INTO otp_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(key, now + 600000).first<{ count: number }>();
    if (!row || row.count > max) throw new Error('Trop de tentatives. Patientez dix minutes puis réessayez.');
  }
}

export async function loginPassword(request: Request, id: ProfileId, password: string) {
  if (!passwordRequired() || !passwordConfigured()) throw new Error('La connexion par mot de passe n’est pas disponible.');
  if (typeof password !== 'string' || password.length < 1 || password.length > 128) throw new Error('Mot de passe incorrect.');
  await attemptLimit(request, id);
  const c = credentials()[id] || await accountCredential(id);
  if (!c) throw new Error('Mot de passe incorrect.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = Uint8Array.from(c.salt.match(/../g)!, x => parseInt(x, 16));
  // Workers supports at most 100,000 PBKDF2 iterations per call. Passwords are generated with 100 bits of randomness.
  const actual = hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256));
  let difference = 0;
  for (let i = 0; i < c.hash.length; i++) difference |= actual.charCodeAt(i) ^ c.hash.charCodeAt(i);
  if (difference) throw new Error('Mot de passe incorrect.');
  const previous = tokenOf(request);
  if (/^[a-f0-9]{64}$/.test(previous)) await env.DB!.prepare('DELETE FROM phone_sessions WHERE token_hash = ?').bind(await digest(previous)).run();
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB!.prepare('DELETE FROM phone_sessions WHERE expires_at <= ?').bind(Date.now()).run();
  // Reuse the existing session table; the credential binding revokes sessions when a password is replaced.
  await env.DB!.prepare('INSERT INTO phone_sessions (token_hash, profile_id, expires_at) VALUES (?, ?, ?)').bind(await digest(token), binding(id, c), Date.now() + 24 * 3600 * 1000).run();
  return { profileId: id, admin: id === 'karima', cookie: `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400` };
}

export async function logoutPassword(request: Request) {
  const token = tokenOf(request);
  if (/^[a-f0-9]{64}$/.test(token) && env.DB) await env.DB.prepare('DELETE FROM phone_sessions WHERE token_hash = ?').bind(await digest(token)).run();
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
