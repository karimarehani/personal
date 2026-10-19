import { congesPolicy, validConge } from '../ui/conges-model.js';
import { validCaisse, validCaisseEntry } from '../ui/caisse-model.js';
import { validRepas, repasMergeMission } from '../ui/repas-model.js';
import { letterheadSociete } from '../ui/letterheads-model.js';
export const PROFILE_IDS = ['karima', 'wijdane', 'samir', 'reda', 'amine'] as const;
export type ProfileId = string;
type RecordItem = { id: string; updated?: string; profileId?: string; [key: string]: unknown };
export type ProfileState = {
  profile: Record<string, unknown> & { id: ProfileId; updated?: string };
  missions: RecordItem[];
  recups: RecordItem[];
  conges: RecordItem[];
  caisses: RecordItem[];
  caisseEntries: RecordItem[];
  counters: Record<string, number>;
  deleted: Record<string, string>;
};
export function isProfileId(id: unknown): id is ProfileId { return typeof id === 'string' && (PROFILE_IDS.some(p => p === id) || /^cp-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)); }
export function emptyState(id: ProfileId): ProfileState {
  const names: Record<string, string[]> = { karima: ['Mme', 'Karima Rehani', 'Directrice de projet'], wijdane: ['Mme', 'Wijdane', 'Cheffe de projet créative'], samir: ['M.', 'Samir', 'Chef de projet production'], reda: ['M.', 'Reda', 'Chef de projet'], amine: ['M.', 'Amine', 'Chef de projet junior'] };
  const [civ, nom, poste] = names[id] || ['M.', 'Chef de projet', 'Chef de projet'];
  return { profile: { id, civ, nom, poste, email: id === 'karima' ? 'k.rehani@bluechili.ma' : '', cin: '', ville: 'Casablanca',
    societe: letterheadSociete(id, { nom: 'Blue Chili', logo: '@bluechili', direction: 'La Direction', footer: ['Blue Chili SARL au capital de 1.000.000,00 Dhs', 'ICE : 001992467000076', 'Villa Brion 7, Rue Khadija Bent Khouailid, Casablanca - Maroc - CP : 20130'] }),
    taux: 3, classe: 1, repasJour: 100, pin: '', favoris: [], congesPolicy: congesPolicy(id), updated: '' }, missions: [], recups: [], conges: [], caisses: [], caisseEntries: [], counters: {}, deleted: {} };
}
export function validateState(input: unknown, id: ProfileId): ProfileState {
  if (!input || typeof input !== 'object') throw new Error('Données invalides.');
  const s = input as ProfileState;
  if (!s.profile || s.profile.id !== id || !Array.isArray(s.missions) || !Array.isArray(s.recups) || !s.counters || !s.deleted) throw new Error('Profil ou données invalides.');
  const conges = s.conges === undefined ? [] : s.conges;
  const caisses = s.caisses === undefined ? [] : s.caisses, caisseEntries = s.caisseEntries === undefined ? [] : s.caisseEntries;
  if (!Array.isArray(conges)) throw new Error('Liste de congés invalide.');
  if (!Array.isArray(caisses) || !Array.isArray(caisseEntries)) throw new Error('Données de caisse invalides.');
  if (s.missions.length > 5000 || s.recups.length > 10000 || conges.length > 5000 || caisses.length > 2000 || caisseEntries.length > 10000) throw new Error('Trop de lignes.');
  for (const m of [...s.missions, ...s.recups, ...conges, ...caisses, ...caisseEntries]) {
    if (!m || typeof m.id !== 'string' || m.id.length > 100 || m.profileId !== id || (m.updated && typeof m.updated !== 'string')) throw new Error('Une ligne appartient à un autre profil.');
  }
  for (const m of s.missions) {
    if (!Array.isArray(m.trajets) || !Array.isArray(m.autres) || typeof m.depart !== 'string' || typeof m.retour !== 'string') throw new Error('Mission invalide.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.depart) || !/^\d{4}-\d{2}-\d{2}$/.test(m.retour) || m.retour < m.depart) throw new Error('Dates de mission invalides.');
    if (!validRepas(m)) throw new Error('Repas invalides : vérifiez les dates et les repas cochés.');
  }
  if (conges.some(record => !validConge(record, id))) throw new Error('Congé invalide : vérifiez le profil, la date et le nombre de jours (par demi-journée).');
  if (caisses.some(record => !validCaisse(record, id))) throw new Error('Caisse invalide : vérifiez le projet, le rattachement et la date.');
  if (caisseEntries.some(record => !validCaisseEntry(record, id))) throw new Error('Mouvement invalide : vérifiez la catégorie, la date et le montant en DH.');
  const allIds = [...caisses, ...caisseEntries].map(r => r.id);
  if (new Set(allIds).size !== allIds.length) throw new Error('Identifiant de caisse ou de mouvement en double.');
  const caisseIds = new Set(caisses.map(c => c.id));
  if (caisseEntries.some(e => !caisseIds.has(String(e.caisseId)) && !s.deleted[String(e.caisseId)])) throw new Error('Un mouvement ne possède pas de caisse dans cette session.');
  return { ...s, conges, caisses, caisseEntries };
}
export function mergeStates(local: ProfileState, incoming: ProfileState): ProfileState {
  const out: ProfileState = { ...local, deleted: { ...local.deleted }, counters: { ...local.counters } };
  for (const [key, value] of Object.entries(incoming.deleted || {})) if (typeof value === 'string' && value > (out.deleted[key] || '')) out.deleted[key] = value;
  const merge = (a: RecordItem[], b: RecordItem[], meals = false) => {
    const map = new Map<string, RecordItem>();
    for (const x of [...a, ...b]) { const prev = map.get(x.id); if (meals) map.set(x.id, repasMergeMission(prev, x)); else if (!prev || (x.updated || '') >= (prev.updated || '')) map.set(x.id, x); }
    return [...map.values()].filter(x => !out.deleted[x.id] || out.deleted[x.id] < (x.updated || ''));
  };
  out.missions = merge(local.missions || [], incoming.missions || [], true);
  out.recups = merge(local.recups || [], incoming.recups || []);
  out.conges = merge(local.conges || [], incoming.conges || []);
  out.caisses = merge(local.caisses || [], incoming.caisses || []);
  out.caisseEntries = merge(local.caisseEntries || [], incoming.caisseEntries || []);
  const caisseIds = new Set(out.caisses.map(c => c.id));
  for (const e of out.caisseEntries) if (!caisseIds.has(String(e.caisseId)) && out.deleted[String(e.caisseId)]) out.deleted[e.id] = [out.deleted[e.id] || '', out.deleted[String(e.caisseId)], e.updated || ''].sort().at(-1)!;
  out.caisseEntries = out.caisseEntries.filter(e => caisseIds.has(String(e.caisseId)));
  out.profile = (incoming.profile.updated || '') >= (local.profile.updated || '') ? { ...emptyState(local.profile.id).profile, ...incoming.profile } : local.profile;
  for (const [key, value] of Object.entries(incoming.counters || {})) if (Number.isSafeInteger(value) && value >= 0) out.counters[key] = Math.max(out.counters[key] || 0, value);
  return out;
}
