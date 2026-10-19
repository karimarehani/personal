import { emptyState, type ProfileState } from './state';
import { congesPolicy } from '../ui/conges-model.js';
import { letterheadSociete } from '../ui/letterheads-model.js';
const VERSION = 1;
type Favorite = { label: string; adresse: string; lat?: number; lon?: number; sourceUrl?: string };
// Operator place records and their JSON-LD coordinates checked on 2026-10-14.
const OFFICE: Favorite = { label: 'Bureau Blue Chili', adresse: 'Villa Brion, 7 Rue Khadija Bent Khouailid, Casablanca 20130', lat: 33.5927184, lon: -7.6232772,
  sourceUrl: 'https://www.waze.com/live-map/directions/ma/casablanca-settat/casablanca/blue-chili?to=place.ChIJm_-NoSfTpw0RLIkFpVqiJIE' };
// This personal preset is returned only through the authenticated Karima profile API.
const HOME: Favorite = { label: 'Résidence Al Yassamine', adresse: 'Résidence Al Yassamine, Jawhara Casablanca', lat: 33.5961641, lon: -7.5152959,
  sourceUrl: 'https://www.waze.com/live-map/directions/ma/casablanca-settat/casablanca/residence-al-yassamine,-jawhara-casablanca?to=place.ChIJE5ZXLCfLpw0RRDlz-Tj0T54' };
const legacy = (value: unknown) => /\bapfe\b/i.test(JSON.stringify(value));
export function applyProfilePresets(input: ProfileState): { state: ProfileState; changed: boolean } {
  const profile = { ...input.profile }, now = new Date().toISOString(), deleted = { ...input.deleted };
  const previous = Array.isArray(profile.favoris) ? profile.favoris as Favorite[] : [];
  let favoris = previous.filter(f => !legacy(f)), changed = favoris.length !== previous.length;
  const policy = congesPolicy(profile.id), previousPolicy = profile.congesPolicy as { debut?: string; mensuel?: number; credit?: string } | null | undefined;
  let congesChanged = false;
  if (policy ? !previousPolicy || previousPolicy.debut !== policy.debut || previousPolicy.mensuel !== policy.mensuel || previousPolicy.credit !== policy.credit : previousPolicy !== null) { profile.congesPolicy = policy; congesChanged = true; }
  const conges = Array.isArray(input.conges) ? input.conges : [];
  if (!Array.isArray(input.conges)) congesChanged = true;
  const caisses = Array.isArray(input.caisses) ? input.caisses : [], caisseEntries = Array.isArray(input.caisseEntries) ? input.caisseEntries : [];
  if (!Array.isArray(input.caisses) || !Array.isArray(input.caisseEntries)) congesChanged = true;
  if (legacy(profile.societe)) { const defaults = emptyState(profile.id).profile; profile.societe = defaults.societe; profile.email = defaults.email; profile.cin = ''; changed = true; }
  const societe = letterheadSociete(profile.id, profile.societe);
  if (JSON.stringify(societe) !== JSON.stringify(profile.societe)) { profile.societe = societe; changed = true; }
  if (typeof profile.email === 'string' && /apfe/i.test(profile.email)) { profile.email = emptyState(profile.id).profile.email; changed = true; }
  const removeLegacy = (records: ProfileState['missions']) => records.filter(record => { if (!legacy(record)) return true; deleted[record.id] = now; changed = true; return false; });
  const missions = removeLegacy(input.missions), recups = removeLegacy(input.recups);
  const counters = Object.fromEntries(Object.entries(input.counters).filter(([key]) => !legacy(key)));
  if (Object.keys(counters).length !== Object.keys(input.counters).length) changed = true;
  if (profile.locationPresetsVersion !== VERSION) {
    const office = favoris.findIndex(f => /blue\s*chili/i.test(f.label));
    if (office >= 0) favoris[office] = { ...favoris[office], ...OFFICE }; else favoris.unshift({ ...OFFICE });
    if (profile.id === 'karima') {
      const home = favoris.findIndex(f => /al\s*yass?amine/i.test(f.label + ' ' + f.adresse));
      if (home >= 0) favoris[home] = { ...favoris[home], ...HOME }; else favoris.splice(1, 0, { ...HOME });
    }
    profile.locationPresetsVersion = VERSION; changed = true;
  }
  if (!changed && !congesChanged) return { state: input, changed: false };
  profile.favoris = favoris;
  if (changed) profile.updated = now;
  return { state: { ...input, profile, missions, recups, conges, caisses, caisseEntries, deleted, counters }, changed: true };
}
