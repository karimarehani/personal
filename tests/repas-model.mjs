import assert from 'node:assert/strict';
import { REPAS_ITEMS, repasDates, repasSummary, validRepas, repasMergeMission } from '../ui/repas-model.js';
let passed = 0;
function check(name, fn) { fn(); passed++; console.log('PASS', name); }
const daily = (rows = {}) => ({ depart: '2026-10-19', retour: '2026-10-21', repasMode: 'journalier', repasParJour: rows });
check('the three rates are 50, 100 and 100 DH', () => assert.deepEqual(REPAS_ITEMS.map(item => item.tarif), [50, 100, 100]));
check('all eight meal combinations total exactly', () => {
  for (let mask = 0; mask < 8; mask++) {
    const choices = Object.fromEntries(REPAS_ITEMS.map((item, index) => [item.key, !!(mask & (1 << index))]));
    const expected = REPAS_ITEMS.reduce((sum, item) => sum + (choices[item.key] ? item.tarif : 0), 0);
    assert.equal(repasSummary(daily({ '2026-10-19': choices })).total, expected);
  }
});
check('meal counts and date totals agree over multiple days', () => {
  const summary = repasSummary(daily({ '2026-10-19': { petitDejeuner: true, dejeuner: true }, '2026-10-20': { diner: true }, '2026-10-21': { dejeuner: true, diner: true } }));
  assert.equal(summary.total, 450); assert.equal(summary.selectionCount, 5);
  assert.deepEqual(summary.days.map(day => day.total), [150, 100, 200]);
  assert.deepEqual(summary.items.map(item => item.count), [1, 2, 2]);
});
check('days removed from the mission stop billing and regain choices if restored', () => {
  const mission = daily({ '2026-10-19': { dejeuner: true }, '2026-10-21': { diner: true }, '2026-10-22': { petitDejeuner: true } });
  assert.equal(repasSummary(mission).total, 200);
  mission.retour = '2026-10-20'; assert.equal(repasSummary(mission).total, 100);
  mission.retour = '2026-10-22'; assert.equal(repasSummary(mission).total, 250);
});
check('historical forfait including decimal input is unchanged', () => {
  const mission = { depart: '2026-10-19', retour: '2026-10-21', repasJour: '100,50', repasJours: '2' };
  assert.equal(repasSummary(mission).total, 201); assert.equal(validRepas(mission), true);
  assert.equal(repasSummary({ ...mission, repasMode: 'journalier', repasParJour: {} }).total, 0);
  assert.equal(repasSummary({ ...mission, repasMode: 'forfait', repasParJour: { '2026-10-19': { diner: true } } }).total, 201);
});
check('empty, reversed, impossible dates and excessively long periods are rejected', () => {
  for (const [depart, retour] of [['', '2026-10-21'], ['2026-10-22', '2026-10-21'], ['2026-02-30', '2026-03-01'], ['2026-01-01', '2040-01-01']]) {
    const mission = { ...daily(), depart, retour }; assert.deepEqual(repasDates(mission), []); assert.equal(validRepas(mission), false);
  }
});
check('long missions include every day beyond the old 62-day limit and leap days', () => {
  assert.equal(repasDates({ depart: '2026-10-19', retour: '2027-02-28' }).length, 133);
  assert.deepEqual(repasDates({ depart: '2028-02-28', retour: '2028-03-01' }), ['2028-02-28', '2028-02-29', '2028-03-01']);
});
check('validation accepts strict booleans only and rejects unknown fields', () => {
  assert.equal(validRepas(daily({ '2026-10-19': { petitDejeuner: true, dejeuner: false } })), true);
  for (const selection of [{ diner: 'true' }, { diner: 100 }, { prix: 500 }, [], null]) assert.equal(validRepas(daily({ '2026-10-19': selection })), false);
  assert.equal(validRepas(daily({ '2026-02-30': { diner: true } })), false);
  assert.equal(repasSummary(daily({ '2026-10-19': { diner: 'true' } })).total, 0);
});
check('older browsers retain stored meals while updating other mission fields', () => {
  const stored = { ...daily({ '2026-10-19': { diner: true } }), updated: '2026-10-19T10:00:00Z' };
  const oldBrowser = { depart: stored.depart, retour: stored.retour, objet: 'Updated', updated: '2026-10-19T11:00:00Z' };
  const merged = repasMergeMission(stored, oldBrowser);
  assert.equal(merged.objet, 'Updated'); assert.equal(repasSummary(merged).total, 100); assert.equal(oldBrowser.repasMode, undefined);
});
check('an explicit new meal selection or switch back to forfait wins', () => {
  const stored = { ...daily({ '2026-10-19': { diner: true } }), repasJour: 75, repasJours: 3, updated: '2026-10-19T10:00:00Z' };
  const cleared = { ...stored, repasParJour: {}, updated: '2026-10-19T11:00:00Z' };
  assert.equal(repasSummary(repasMergeMission(stored, cleared)).total, 0);
  assert.equal(repasSummary(repasMergeMission(stored, { ...cleared, repasMode: 'forfait' })).total, 225);
});
console.log('Meal model tests passed:', passed);
