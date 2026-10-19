import { env } from 'cloudflare:workers';
import { emptyState, isProfileId, PROFILE_IDS } from './state';
import { applyProfilePresets } from './profile-presets';

type AccountRow = { id: string; name: string; position: string; civ: string; created_at: string };
export type AccountChoice = { id: string; nom: string; poste: string; civ: string; admin: boolean; createdAt: string | null };
const keyOf = (name: string) => name.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr').replace(/\s+/g, ' ').trim();
export class AccountError extends Error { constructor(message: string, public status = 400) { super(message); } }
function db() { if (!env.DB) throw new Error('Gestion des comptes indisponible.'); return env.DB; }

export async function listAccounts(): Promise<AccountChoice[]> {
  const base = PROFILE_IDS.map(id => { const p = emptyState(id).profile; return { id, nom: String(p.nom), poste: String(p.poste), civ: String(p.civ), admin: id === 'karima', createdAt: null }; });
  const rows = await db().prepare('SELECT id, name, position, civ, created_at FROM project_accounts ORDER BY created_at, id').all<AccountRow>();
  return [...base, ...rows.results.map(r => ({ id: r.id, nom: r.name, poste: r.position, civ: r.civ, admin: false, createdAt: r.created_at }))];
}
export async function accountCredential(id: string) {
  if (!isProfileId(id) || PROFILE_IDS.some(p => p === id)) return null;
  const row = await db().prepare('SELECT password_salt, password_hash FROM project_accounts WHERE id = ?').bind(id).first<{ password_salt: string; password_hash: string }>();
  return row ? { salt: row.password_salt, hash: row.password_hash } : null;
}
export async function registeredProfile(id: string) { return isProfileId(id) && (PROFILE_IDS.some(p => p === id) || !!await accountCredential(id)); }
const hex = (bytes: ArrayBuffer | Uint8Array) => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');

export async function createAccount(input: unknown) {
  if (!input || typeof input !== 'object') throw new AccountError('Compte invalide.');
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(k => !['nom', 'poste', 'civ'].includes(k))) throw new AccountError('Seuls les comptes de chef de projet peuvent être créés.');
  const clean = (value: unknown, max: number) => typeof value === 'string' && !/[\u0000-\u001f\u007f<>]/.test(value) && value.trim().length <= max ? value.trim().replace(/\s+/g, ' ') : '';
  const nom = clean(data.nom, 100), poste = clean(data.poste ?? 'Chef de projet', 100), civ = data.civ;
  if (nom.length < 2 || poste.length < 2 || !['Mme', 'M.'].includes(String(civ))) throw new AccountError('Indiquez un nom, un poste et une civilité valides.');
  const nameKey = keyOf(nom), accounts = await listAccounts();
  if (accounts.some(a => keyOf(a.nom) === nameKey || keyOf(a.id) === nameKey)) throw new AccountError('Une session existe déjà sous ce nom.', 409);
  const id = 'cp-' + crypto.randomUUID(), now = new Date().toISOString();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const password = [...crypto.getRandomValues(new Uint8Array(20))].map(x => alphabet[x & 31]).join('').match(/.{5}/g)!.join('-');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256));
  const state = emptyState(id);
  Object.assign(state.profile, { nom, poste, civ, updated: now });
  const initial = applyProfilePresets(state).state;
  try {
    await db().batch([
      db().prepare('INSERT INTO project_accounts (id, name, name_key, position, civ, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, nom, nameKey, poste, civ, hex(salt), hash, now),
      db().prepare('INSERT INTO profile_states (id, state, revision, updated_at) VALUES (?, ?, 1, ?)').bind(id, JSON.stringify(initial), now),
    ]);
  } catch (error) {
    if (error instanceof Error && /unique|constraint/i.test(error.message)) throw new AccountError('Une session existe déjà sous ce nom.', 409);
    throw error;
  }
  return { account: { id, nom, poste, civ, admin: false, createdAt: now }, password, state: initial };
}
