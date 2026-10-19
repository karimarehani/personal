function repasSummaryHTML(mission) {
  const summary = repasSummary(mission);
  if (!summary.daily) return `<dt>Repas · forfait historique</dt><dd>${money(summary.total)}</dd>`;
  return summary.items.map(item => `<dt>${item.label} (${item.count} × ${item.tarif} DH)</dt><dd>${money(item.total)}</dd>`).join('');
}
function repasPdfRows(mission) {
  const summary = repasSummary(mission);
  if (!summary.daily) return [[`Repas : ${num(mission.repasJours)} jour(s) × ${money(mission.repasJour)} DH (forfait historique)`, money(summary.total)]];
  return summary.items.map(item => [`${item.label} : ${item.count} × ${money(item.tarif)} DH`, money(item.total)]);
}
function renderRepas() {
  const box = $('#repas-ui'), mission = cur;
  if (!box || !mission) return;
  const summary = repasSummary(mission), historic = num(mission.repasJour) * num(mission.repasJours);
  if (!summary.daily) {
    box.innerHTML = `<div class="repas-legacy"><strong>Forfait historique : ${moneyDH(summary.total)}</strong><p>Montant conservé : ${num(mission.repasJours)} jour(s) × ${moneyDH(mission.repasJour)}. Vous pouvez choisir les repas de chaque jour pour recalculer ce déplacement.</p><button class="btn" id="repas-daily">Choisir les repas par jour</button></div>`;
    $('#repas-daily').onclick = () => { mission.repasMode = 'journalier'; mission.repasParJour ||= {}; renderRepas(); changed(); };
    return;
  }
  box.innerHTML = `<p class="hint repas-intro">Cochez uniquement les repas à indemniser pour chaque jour du déplacement.</p>
    <div class="repas-table-wrap"><table class="repas-table"><thead><tr><th scope="col">Jour</th>${REPAS_ITEMS.map(item => `<th scope="col">${item.label}<small>${item.tarif} DH</small></th>`).join('')}<th scope="col">Total</th></tr></thead>
    <tbody>${summary.days.map(day => `<tr><th scope="row">${esc(frDate(day.date))}</th>${REPAS_ITEMS.map(item => `<td><label class="repas-choice"><input type="checkbox" data-repas-date="${day.date}" data-repas-key="${item.key}" aria-label="${item.label} du ${esc(frDate(day.date))} · ${item.tarif} DH" ${day.selection[item.key] === true ? 'checked' : ''}><span class="repas-choice-label">${item.label}<small>${item.tarif} DH</small></span></label></td>`).join('')}<td data-repas-total="${day.date}">${moneyDH(day.total)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><th scope="row" colspan="4">Total repas</th><td id="repas-total">${moneyDH(summary.total)}</td></tr></tfoot></table></div>
    ${summary.days.length ? '' : '<p class="hint" role="status">Renseignez des dates de départ et de retour valides.</p>'}
    <div class="legbar repas-actions"><button class="btn small" data-repas-all="1">Tout cocher</button><button class="btn small" data-repas-all="0">Tout décocher</button>${historic ? `<button class="btn small ghost" id="repas-legacy">Revenir au forfait historique (${moneyDH(historic)})</button>` : ''}</div>`;
  box.onchange = event => {
    const input = event.target.closest('[data-repas-key]');
    if (!input || cur !== mission) return;
    const date = input.dataset.repasDate, key = input.dataset.repasKey;
    if (!repasDates(mission).includes(date) || !REPAS_ITEMS.some(item => item.key === key)) return;
    mission.repasParJour ||= {};
    mission.repasParJour[date] = { ...(mission.repasParJour[date] || {}), [key]: input.checked };
    const updated = repasSummary(mission);
    $(`[data-repas-total="${date}"]`, box).textContent = moneyDH(updated.days.find(day => day.date === date).total);
    $('#repas-total').textContent = moneyDH(updated.total);
    changed();
  };
  $$('[data-repas-all]', box).forEach(button => button.onclick = () => {
    mission.repasParJour ||= {};
    for (const date of repasDates(mission)) mission.repasParJour[date] = Object.fromEntries(REPAS_ITEMS.map(item => [item.key, button.dataset.repasAll === '1']));
    renderRepas(); changed();
  });
  if ($('#repas-legacy')) $('#repas-legacy').onclick = () => { mission.repasMode = 'forfait'; renderRepas(); changed(); };
}
function repasPdfDetail(doc, mission, y) {
  const summary = repasSummary(mission);
  if (!summary.daily || !summary.days.length) return y;
  doc.autoTable({ startY: y, theme: 'grid', margin: { left: 15, right: 15, top: 18, bottom: 30 },
    head: [['Repas par jour', ...REPAS_ITEMS.map(item => `${item.label} (${item.tarif} DH)`), 'Total (DH)'].map(pdfTxt)],
    body: summary.days.map(day => [frDate(day.date), ...REPAS_ITEMS.map(item => day.selection[item.key] === true ? money(item.tarif) : '-'), money(day.total)].map(pdfTxt)),
    foot: [[{ content: 'TOTAL REPAS', colSpan: 4 }, money(summary.total)]],
    styles: { fontSize: 8, cellPadding: 2.2, lineColor: [190, 200, 215], halign: 'right' },
    headStyles: { fillColor: BRAND }, footStyles: { fillColor: [230, 238, 248], textColor: BRAND }, columnStyles: { 0: { halign: 'left' } } });
  return doc.lastAutoTable.finalY + 10;
}
