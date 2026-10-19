import { env } from 'cloudflare:workers';
import { emptyState, mergeStates, type ProfileId, type ProfileState } from './state';
import { applyProfilePresets } from './profile-presets';
import { congesSummary } from '../ui/conges-model.js';
const db = () => { if (!env.DB) throw new Error('La sauvegarde serveur est indisponible.'); return env.DB; };
export async function readProfile(id: ProfileId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await db().prepare('SELECT state, revision FROM profile_states WHERE id = ?').bind(id).first<{ state: string; revision: number }>();
    const current = row ? JSON.parse(row.state) as ProfileState : emptyState(id), migrated = applyProfilePresets(current);
    if (!migrated.changed) return { state: current, revision: row?.revision || 0, congesSummary: congesSummary(current) };
    if (!row) {
      const inserted = await db().prepare('INSERT INTO profile_states (id, state, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(id) DO NOTHING').bind(id, JSON.stringify(migrated.state), new Date().toISOString()).run();
      if (inserted.meta.changes) return { state: migrated.state, revision: 1, congesSummary: congesSummary(migrated.state) };
    } else {
      const updated = await db().prepare('UPDATE profile_states SET state = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?').bind(JSON.stringify(migrated.state), new Date().toISOString(), id, row.revision).run();
      if (updated.meta.changes) return { state: migrated.state, revision: row.revision + 1, congesSummary: congesSummary(migrated.state) };
    }
  }
  throw new Error('Initialisation concurrente : veuillez réessayer.');
}
export async function saveProfile(id: ProfileId, incoming: ProfileState) {
  const base = emptyState(id);
  await db().prepare('INSERT INTO profile_states (id, state, revision, updated_at) VALUES (?, ?, 0, ?) ON CONFLICT(id) DO NOTHING').bind(id, JSON.stringify(base), new Date().toISOString()).run();
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await readProfile(id), merged = applyProfilePresets(mergeStates(current.state, incoming)).state;
    const result = await db().prepare('UPDATE profile_states SET state = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?').bind(JSON.stringify(merged), new Date().toISOString(), id, current.revision).run();
    if (result.meta.changes) return { state: merged, revision: current.revision + 1, congesSummary: congesSummary(merged) };
  }
  throw new Error('Sauvegarde concurrente : veuillez réessayer.');
}
