// Rule supplied by the owner: three employees joined on September 1, 2026, 1.5 days per completed month.
export function congesPolicy(profileId) {
  return ['karima', 'wijdane', 'samir'].includes(profileId) ? { debut: '2026-09-01', mensuel: 1.5, credit: 'fin-mois' } : null;
}

export function congesTodayISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function validCongeDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validConge(record, profileId) {
  const policy = congesPolicy(profileId);
  return !!policy && !!record && typeof record.id === 'string' && record.id.length > 0 && record.id.length <= 100 && record.profileId === profileId
    && validCongeDate(record.date) && record.date >= policy.debut && typeof record.jours === 'number' && Number.isFinite(record.jours)
    && record.jours > 0 && record.jours <= 366 && Number.isInteger(record.jours * 2)
    && (record.updated === undefined || typeof record.updated === 'string')
    && (record.note === undefined || typeof record.note === 'string' && record.note.length <= 2000);
}

function congesCompletedMonths(policy, asOf) {
  const [year, month, day] = asOf.split('-').map(Number);
  const [startYear, startMonth] = policy.debut.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.max(0, (year - startYear) * 12 + month - startMonth + (day === last ? 1 : 0));
}

export function congesSummary(state, asOf = congesTodayISO()) {
  const profileId = state.profile.id, policy = congesPolicy(profileId);
  if (!policy) return null;
  if (!validCongeDate(asOf)) throw new Error('Date du compteur invalide.');
  const records = (state.conges || []).filter(record => validConge(record, profileId));
  const sum = rows => rows.reduce((total, record) => total + record.jours, 0);
  const moisAcquis = congesCompletedMonths(policy, asOf), acquis = moisAcquis * policy.mensuel;
  const pris = sum(records.filter(record => record.date <= asOf)), prevus = sum(records.filter(record => record.date > asOf));
  const year = +asOf.slice(0, 4), before = `${year - 1}-12-31`, start = `${year}-01-01`;
  const report = congesCompletedMonths(policy, before) * policy.mensuel - sum(records.filter(record => record.date < start));
  let running = report;
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    const end = `${month}-${new Date(Date.UTC(year, index + 1, 0)).getUTCDate()}`;
    const earned = end >= policy.debut && end <= asOf ? policy.mensuel : 0;
    const monthRecords = records.filter(record => record.date.startsWith(month));
    const taken = sum(monthRecords.filter(record => record.date <= asOf));
    running += earned - taken;
    return { month, end, acquis: earned, pris: taken, prevus: sum(monthRecords.filter(record => record.date > asOf)), solde: running };
  });
  return { ...policy, asOf, moisAcquis, acquis, pris, prevus, solde: acquis - pris, soldeApresPrevus: acquis - pris - prevus, report, annuel: 12 * policy.mensuel, months };
}
