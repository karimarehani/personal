export const REPAS_ITEMS = Object.freeze([
  { key: 'petitDejeuner', label: 'Petit-déjeuner', tarif: 50 },
  { key: 'dejeuner', label: 'Déjeuner', tarif: 100 },
  { key: 'diner', label: 'Dîner', tarif: 100 }
]);
const REPAS_MAX_DAYS = 3660;
function repasDateTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}
export function repasDates(mission) {
  const start = repasDateTime(mission?.depart), end = repasDateTime(mission?.retour);
  const count = (end - start) / 86400000 + 1;
  if (!Number.isInteger(count) || count < 1 || count > REPAS_MAX_DAYS) return [];
  return Array.from({ length: count }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));
}
function repasNumber(value) {
  let text = String(value ?? '').trim().replace(/[\s\u00a0\u202f]/g, '');
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  const result = /^-?\d*(?:\.\d+)?$/.test(text) ? Number(text) : 0;
  return Number.isFinite(result) ? result : 0;
}
export function repasSummary(mission) {
  const daily = mission?.repasMode === 'journalier';
  const items = REPAS_ITEMS.map(item => ({ ...item, count: 0, total: 0 }));
  if (!daily) return { daily, items, days: [], selectionCount: 0, total: repasNumber(mission?.repasJour) * repasNumber(mission?.repasJours) };
  const days = repasDates(mission).map(date => {
    const selection = mission.repasParJour?.[date] || {};
    let total = 0;
    for (const item of items) if (selection[item.key] === true) { item.count++; item.total += item.tarif; total += item.tarif; }
    return { date, selection, total };
  });
  return { daily, items, days, selectionCount: items.reduce((sum, item) => sum + item.count, 0), total: items.reduce((sum, item) => sum + item.total, 0) };
}
export function validRepas(mission) {
  if (!mission || typeof mission !== 'object') return false;
  if (mission.repasMode === undefined && mission.repasParJour === undefined) return true;
  if (!['journalier', 'forfait'].includes(mission.repasMode)) return false;
  if (mission.repasMode === 'journalier' && !repasDates(mission).length) return false;
  const rows = mission.repasParJour;
  if (!rows || typeof rows !== 'object' || Array.isArray(rows) || Object.keys(rows).length > REPAS_MAX_DAYS) return false;
  return Object.entries(rows).every(([date, selection]) => Number.isFinite(repasDateTime(date)) && selection && typeof selection === 'object' && !Array.isArray(selection)
    && Object.entries(selection).every(([key, value]) => REPAS_ITEMS.some(item => item.key === key) && typeof value === 'boolean'));
}
// An older browser can update a mission without knowing its meal fields.
export function repasMergeMission(a, b) {
  if (!a) return b;
  if (!b) return a;
  const latest = (b.updated || '') >= (a.updated || '') ? b : a;
  const other = latest === b ? a : b;
  let result = latest;
  for (const key of ['repasMode', 'repasParJour']) if (latest[key] === undefined && other[key] !== undefined) {
    if (result === latest) result = { ...latest };
    result[key] = other[key];
  }
  return result;
}
