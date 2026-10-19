/* Gestion de caisse. Drafts and in-flight recognition are isolated by session and cashbox. */
let caisseViews = {}, caisseDrafts = {}, caisseEpoch = 0;
function resetCaisseUI(){ caisseViews = {}; caisseDrafts = {}; caisseEpoch++; }
const caisseDH = cents => moneyDH(cents / 100);
const caisseAmount = cents => Number.isSafeInteger(cents) ? (cents / 100).toFixed(2).replace('.', ',') : '';
const caisseCategoryLabel = id => CAISSE_CATEGORIES.find(c => c.id === id)?.label || '—';
function caisseView(){ return caisseViews[P.id] ||= { id: '', q: '', statut: '', categorie: '', recognition: false }; }
function caisseDraft(id){ return caisseDrafts[P.id + ':' + id] ||= { text: '', ticketText: '', input: 'texte', mode: 'ticket', files: [], rows: [], notices: [], busy: false, status: '' }; }
function caisseSelected(){ return DB.caisses.find(c => c.profileId === P.id && c.id === caisseView().id); }
function persistCaisse(pid){ save(); if(pid !== P?.id) Cloud.schedule(pid); }
function caisseOptions(selected){ return CAISSE_CATEGORIES.map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.label)}</option>`).join(''); }
function saveCaisseRecord(fields, id){
  const old = id && DB.caisses.find(c => c.id === id && c.profileId === P.id);
  if(id && !old) throw Error('Cette caisse est introuvable.');
  const mission = fields.type === 'deplacement' && DB.missions.find(m => m.id === fields.missionId && m.profileId === P.id);
  if(fields.type === 'deplacement' && !mission && !old?.missionId) throw Error('Choisissez un déplacement de cette session.');
  const record = { ...old, id: old?.id || uid(), profileId: P.id, nom: String(fields.nom || '').trim(),
    projet: String(fields.projet || '').trim(), ville: String(fields.ville || '').trim(), date: fields.date,
    type: fields.type, missionId: fields.type === 'deplacement' ? (mission?.id || old?.missionId) : '',
    missionLabel: fields.type === 'deplacement' ? (mission ? [mission.numero, mission.destination].filter(Boolean).join(' · ') : old.missionLabel) : '',
    statut: old?.statut || 'ouverte', updated: new Date().toISOString() };
  if(!validCaisse(record, P.id)) throw Error('Renseignez le nom, le projet, la date et le rattachement de la caisse.');
  if(old) DB.caisses[DB.caisses.indexOf(old)] = record; else DB.caisses.push(record);
  persistCaisse(P.id); return record;
}
function saveCaisseEntry(fields, id){
  const c = DB.caisses.find(x => x.id === fields.caisseId && x.profileId === P.id);
  if(!c || c.statut !== 'ouverte') throw Error('Ouvrez une caisse active pour saisir un mouvement.');
  const old = id && DB.caisseEntries.find(e => e.id === id && e.profileId === P.id && e.caisseId === c.id);
  if(id && !old) throw Error('Mouvement introuvable.');
  const record = { ...old, ...fields, id: old?.id || uid(), profileId: P.id, montantCts: caisseCents(fields.montant),
    libelle: String(fields.libelle || '').trim(), fournisseur: String(fields.fournisseur || '').trim(),
    categorie: fields.type === 'depense' ? fields.categorie : '', updated: new Date().toISOString() };
  record.created = old?.created || old?.updated || record.updated;
  delete record.montant;
  if(!validCaisseEntry(record, P.id)) throw Error('Vérifiez la date, le libellé, la catégorie et le montant positif en DH (2 décimales au maximum).');
  if(old) DB.caisseEntries[DB.caisseEntries.indexOf(old)] = record; else DB.caisseEntries.push(record);
  persistCaisse(P.id); return record;
}
function deleteCaisseEntry(id){
  const entry = DB.caisseEntries.find(e => e.id === id && e.profileId === P.id);
  const c = entry && DB.caisses.find(c => c.id === entry.caisseId && c.profileId === P.id);
  if(!c || c.statut !== 'ouverte') return false;
  DB.deleted[id] = new Date().toISOString(); DB.caisseEntries = DB.caisseEntries.filter(e => e !== entry); persistCaisse(P.id); return true;
}
function openMissionCaisse(m){
  if(!m || m.profileId !== P.id) return;
  persistCurrent();
  const existing = DB.caisses.find(c => c.profileId === P.id && c.missionId === m.id);
  go('caisse');
  if(existing){ caisseView().id = existing.id; renderCaisse(); } else editCaisseDialog(null, m);
}
function editCaisseDialog(c, mission){
  const mine = DB.missions.filter(m => m.profileId === P.id).sort((a, b) => b.depart.localeCompare(a.depart));
  const selected = mission?.id || c?.missionId || '', type = c?.type || (mission ? 'deplacement' : 'projet');
  dialog(`<h3>${c ? 'Modifier la caisse' : 'Nouvelle caisse'}</h3><p>Un projet peut avoir une caisse sans déplacement, y compris à Casablanca.</p>
    <form id="caisse-form"><div class="grid">
      <div class="f"><label for="c-type">Rattachement</label><select id="c-type"><option value="projet" ${type === 'projet' ? 'selected' : ''}>Projet sans déplacement</option><option value="deplacement" ${type === 'deplacement' ? 'selected' : ''}>Déplacement</option></select></div>
      <div class="f" id="c-mission-wrap"><label for="c-mission">Déplacement</label><select id="c-mission"><option value="">Choisir…</option>${mine.map(m => `<option value="${esc(m.id)}" ${m.id === selected ? 'selected' : ''}>${esc([m.numero, m.projet || m.objet, m.destination, frDate(m.depart)].filter(Boolean).join(' · '))}</option>`).join('')}${c?.missionId && !mine.some(m => m.id === c.missionId) ? `<option value="${esc(c.missionId)}" selected>${esc(c.missionLabel || 'Déplacement supprimé')}</option>` : ''}</select></div>
      <div class="f wide"><label for="c-name">Nom de la caisse</label><input id="c-name" maxlength="160" value="${esc(c?.nom || (mission ? 'Caisse · ' + (mission.projet || mission.destination || 'Déplacement') : ''))}" placeholder="Ex. Production · Convention Casablanca" required></div>
      <div class="f"><label for="c-project">Projet / événement</label><input id="c-project" maxlength="200" value="${esc(c?.projet || mission?.projet || mission?.objet || '')}" required></div>
      <div class="f"><label for="c-city">Ville</label><input id="c-city" maxlength="160" value="${esc(c?.ville || mission?.destination || 'Casablanca')}"></div>
      <div class="f"><label for="c-date">Date d’ouverture</label><input id="c-date" type="date" min="2000-01-01" max="2100-12-31" value="${esc(c?.date || mission?.depart || congesTodayISO())}" required></div>
      ${c ? '' : '<div class="f"><label for="c-initial">Avance initiale reçue (DH, facultatif)</label><input id="c-initial" inputmode="decimal" placeholder="0,00"></div>'}
    </div><p class="caisse-message" id="c-error" role="status"></p><div class="row"><button class="btn" type="button" data-close>Annuler</button><button class="btn primary" type="submit">${c ? 'Enregistrer' : 'Créer la caisse'}</button></div></form>`);
  const updateType = () => { $('#c-mission-wrap').hidden = $('#c-type').value !== 'deplacement'; $('#c-mission').required = $('#c-type').value === 'deplacement'; };
  updateType(); $('#c-type').onchange = updateType;
  $('#c-mission').onchange = () => { const m = mine.find(m => m.id === $('#c-mission').value); if(m){ $('#c-project').value = m.projet || m.objet || ''; $('#c-city').value = m.destination || ''; if(!c) $('#c-name').value = 'Caisse · ' + (m.projet || m.destination || 'Déplacement'); } };
  $('#caisse-form').onsubmit = e => {
    e.preventDefault();
    try {
      const initial = !c && $('#c-initial').value.trim() ? caisseCents($('#c-initial').value) : 0;
      if(!Number.isSafeInteger(initial) || initial < 0) throw Error('Avance initiale invalide. Utilisez un montant en DH avec 2 décimales au maximum.');
      const saved = saveCaisseRecord({ nom: $('#c-name').value, projet: $('#c-project').value, ville: $('#c-city').value, date: $('#c-date').value, type: $('#c-type').value, missionId: $('#c-mission').value }, c?.id);
      if(initial) saveCaisseEntry({ caisseId: saved.id, date: saved.date, type: 'entree', libelle: 'Avance initiale reçue', fournisseur: '', categorie: '', montant: caisseAmount(initial), source: 'manuel' });
      caisseView().id = saved.id; closeDialog(); renderCaisse(); toast(c ? 'Caisse mise à jour.' : 'Caisse créée.');
    } catch(error){ $('#c-error').textContent = error.message; }
  };
}
function caisseEntryDialog(c, type = 'depense', entry){
  if(c.statut !== 'ouverte') return toast('Rouvrez la caisse pour modifier ses mouvements.');
  dialog(`<h3>${entry ? 'Modifier le mouvement' : CAISSE_TYPES[type]}</h3><form id="c-entry-form"><div class="grid">
    <div class="f"><label for="ce-date">Date</label><input id="ce-date" type="date" min="2000-01-01" max="2100-12-31" value="${esc(entry?.date || congesTodayISO())}" required></div>
    <div class="f"><label for="ce-amount">Montant (DH)</label><input id="ce-amount" inputmode="decimal" value="${esc(entry ? caisseAmount(entry.montantCts) : '')}" placeholder="0,00" required></div>
    ${type === 'depense' ? `<div class="f"><label for="ce-category">Typologie de dépense</label><select id="ce-category">${caisseOptions(entry?.categorie || 'autre')}</select></div>` : ''}
    <div class="f"><label for="ce-vendor">${type === 'entree' ? 'Remis par' : type === 'restitution' ? 'Restitué à' : 'Fournisseur / bénéficiaire'} (facultatif)</label><input id="ce-vendor" maxlength="200" value="${esc(entry?.fournisseur || '')}"></div>
    <div class="f wide"><label for="ce-label">Libellé</label><input id="ce-label" maxlength="500" value="${esc(entry?.libelle || (type === 'entree' ? 'Avance reçue' : type === 'restitution' ? 'Restitution du reliquat' : ''))}" required></div>
    </div>${entry?.justificatif ? `<p class="hint">Justificatif conservé : ${esc(entry.justificatif.name)}</p>` : ''}
    <p class="caisse-message" id="ce-error" role="status"></p><div class="row"><button class="btn" type="button" data-close>Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div></form>`);
  $('#c-entry-form').onsubmit = e => { e.preventDefault(); try { saveCaisseEntry({ caisseId: c.id, date: $('#ce-date').value, montant: $('#ce-amount').value, type, categorie: type === 'depense' ? $('#ce-category').value : '', libelle: $('#ce-label').value, fournisseur: $('#ce-vendor').value, source: entry?.source || 'manuel' }, entry?.id); closeDialog(); renderCaisse(); toast('Mouvement enregistré.'); } catch(error){ $('#ce-error').textContent = error.message; } };
}
function renderCaisse(){
  if(!P) return;
  const v = caisseView(), mine = DB.caisses.filter(c => c.profileId === P.id).sort((a, b) => b.date.localeCompare(a.date) || a.nom.localeCompare(b.nom, 'fr'));
  const list = mine.filter(c => (!v.statut || c.statut === v.statut) && (!v.q || norm(c.nom + ' ' + c.projet + ' ' + c.ville + ' ' + c.missionLabel).includes(norm(v.q))));
  const c = caisseSelected();
  if(!c){
    const S = caisseStatement(stateFor(P.id));
    $('#view').innerHTML = `<div class="pagehead"><div><h1>Gestion de caisse</h1><p>${esc(P.nom)} · Déplacements et projets, à Casablanca ou ailleurs.</p></div><button class="btn primary" id="new-caisse">+ Nouvelle caisse</button></div>
      <div class="kpis caisse-kpis"><div class="kpi"><span>Avances reçues</span><b>${caisseDH(S.entreesCts)}</b><small>Toutes les caisses de cette session</small></div><div class="kpi"><span>Dépenses de caisse</span><b>${caisseDH(S.depensesCts)}</b><small>${S.journal.filter(e => e.type === 'depense').length} dépense(s)</small></div><div class="kpi"><span>Restitué</span><b>${caisseDH(S.restitutionsCts)}</b></div><div class="kpi"><span>Solde en caisse</span><b class="${S.soldeCts < 0 ? 'due' : 'ok'}">${caisseDH(S.soldeCts)}</b><small>Avances − dépenses − restitutions</small></div></div>
      <section class="block"><header><div><h2>Mes caisses</h2><p>Chaque caisse garde son journal et son état par typologie.</p></div></header>
      <div class="caisse-filters"><div class="f"><label for="caisse-search">Rechercher un projet, une ville…</label><input id="caisse-search" value="${esc(v.q)}" type="search"></div><div class="f"><label for="caisse-status">Statut</label><select id="caisse-status"><option value="">Toutes</option><option value="ouverte" ${v.statut === 'ouverte' ? 'selected' : ''}>Ouvertes</option><option value="cloturee" ${v.statut === 'cloturee' ? 'selected' : ''}>Clôturées</option></select></div></div>
      <div class="caisse-cards">${list.map(c => { const s = caisseStatement(stateFor(P.id), c.id); return `<button class="caisse-card" data-caisse-open="${esc(c.id)}"><div class="caisse-card-top"><span class="caisse-tag ${c.statut === 'ouverte' ? 'active' : ''}">${c.statut === 'ouverte' ? 'Ouverte' : 'Clôturée'}</span><small>${frDate(c.date)}</small></div><h3>${esc(c.nom)}</h3><p>${esc(c.projet)}${c.ville ? ' · ' + esc(c.ville) : ''}</p><p class="hint">${c.type === 'deplacement' ? 'Déplacement · ' + esc(c.missionLabel || 'Mission liée') : 'Projet sans déplacement'}</p><div class="caisse-card-bottom"><span>Dépensé <b>${caisseDH(s.depensesCts)}</b></span><span>Solde <b class="${s.soldeCts < 0 ? 'due' : ''}">${caisseDH(s.soldeCts)}</b></span></div></button>`; }).join('') || `<div class="empty"><p>${mine.length ? 'Aucune caisse pour ces critères.' : 'Créez une première caisse pour suivre vos avances et dépenses de projet.'}</p></div>`}</div></section>`;
    $('#new-caisse').onclick = () => editCaisseDialog();
    $('#caisse-search').oninput = e => { v.q = e.target.value; const start = e.target.selectionStart; renderCaisse(); $('#caisse-search').focus(); $('#caisse-search').setSelectionRange?.(start, start); };
    $('#caisse-status').onchange = e => { v.statut = e.target.value; renderCaisse(); };
    $$('[data-caisse-open]').forEach(b => b.onclick = () => { v.id = b.dataset.caisseOpen; v.categorie = ''; renderCaisse(); }); return;
  }
  const S = caisseStatement(stateFor(P.id), c.id), rows = S.journal.filter(e => !v.categorie || e.type === 'depense' && e.categorie === v.categorie), closed = c.statut !== 'ouverte';
  $('#view').innerHTML = `<div class="pagehead"><div><button class="btn ghost small" id="caisse-back">← Toutes mes caisses</button><h1>${esc(c.nom)}</h1><p>${esc(c.projet)} · ${esc(c.ville || 'Ville non renseignée')} · ${esc(P.nom)}</p><p class="hint">${c.type === 'deplacement' ? 'Rattachée à ' + esc(c.missionLabel || 'un déplacement') : 'Projet sans déplacement'} · Depuis le ${frDate(c.date)} · ${closed ? 'Clôturée' : 'Ouverte'}</p></div><div class="caisse-actions"><button class="btn" id="caisse-edit">Modifier</button><button class="btn" id="caisse-pdf">État PDF</button><button class="btn" id="caisse-csv">Export CSV</button></div></div>
    <div class="kpis caisse-kpis"><div class="kpi"><span>Avances reçues</span><b>${caisseDH(S.entreesCts)}</b></div><div class="kpi"><span>Dépenses</span><b>${caisseDH(S.depensesCts)}</b><small>${S.journal.filter(e => e.type === 'depense').length} dépense(s)</small></div><div class="kpi"><span>Restitué</span><b>${caisseDH(S.restitutionsCts)}</b></div><div class="kpi"><span>Solde disponible</span><b class="${S.soldeCts < 0 ? 'due' : 'ok'}">${caisseDH(S.soldeCts)}</b><small>${S.soldeCts < 0 ? 'Dépenses supérieures aux fonds reçus' : 'Avances − dépenses − restitutions'}</small></div></div>
    <section class="block"><header><div><h2>Dépenses par typologie</h2><p>Montants cumulés de cette caisse, en DH.</p></div></header><div class="caisse-categories">${S.categories.map(cat => `<div class="caisse-category"><div><span>${esc(cat.label)}</span><b>${caisseDH(cat.montantCts)}</b></div><div class="caisse-meter"><i style="width:${S.depensesCts ? Math.round(cat.montantCts / S.depensesCts * 100) : 0}%"></i></div><small>${cat.count} dépense(s)</small></div>`).join('')}</div></section>
    <section class="block"><header><div><h2>Journal de caisse</h2><p>Les dépenses de caisse sont suivies séparément des notes de frais de déplacement.</p></div></header>
      <div class="caisse-actions caisse-journal-actions"><button class="btn" id="caisse-in" ${closed ? 'disabled' : ''}>+ Avance reçue</button><button class="btn primary" id="caisse-spend" ${closed ? 'disabled' : ''}>+ Dépense</button><button class="btn leaf" id="caisse-text" ${closed ? 'disabled' : ''}>Texte → tableau</button><button class="btn" id="caisse-recognition" ${closed ? 'disabled' : ''}>Lire des justificatifs</button><button class="btn" id="caisse-return" ${closed ? 'disabled' : ''}>Restituer un solde</button><div class="f"><label for="caisse-category-filter">Afficher une typologie</label><select id="caisse-category-filter"><option value="">Tous les mouvements</option>${caisseOptions(v.categorie)}</select></div></div>
      ${closed ? '<p class="hint">Cette caisse est clôturée. Rouvrez-la pour ajouter ou modifier des mouvements.</p>' : ''}
      ${rows.length ? `<div class="tbl-wrap"><table class="caisse-journal"><thead><tr><th>Date</th><th>Libellé / bénéficiaire</th><th>Typologie</th><th class="num">Entrée (DH)</th><th class="num">Sortie (DH)</th><th class="num">Solde (DH)</th><th>Justificatif</th><th></th></tr></thead><tbody>${rows.map(e => `<tr><td>${frDate(e.date)}</td><td><b>${esc(e.libelle)}</b>${e.fournisseur ? `<br><small>${esc(e.fournisseur)}</small>` : ''}<br><small>${CAISSE_TYPES[e.type]}</small></td><td>${e.type === 'depense' ? esc(caisseCategoryLabel(e.categorie)) : '—'}</td><td class="num ok">${e.type === 'entree' ? money(e.montantCts / 100) : '—'}</td><td class="num">${e.type !== 'entree' ? money(e.montantCts / 100) : '—'}</td><td class="num ${e.soldeCts < 0 ? 'due' : ''}">${money(e.soldeCts / 100)}</td><td>${e.justificatif ? `<a class="caisse-receipt" href="/api/caisse/receipts/${encodeURIComponent(P.id)}/${encodeURIComponent(e.justificatif.id)}" download="${esc(e.justificatif.name)}">${esc(e.justificatif.name)}</a>` : '<span class="hint">—</span>'}</td><td><div class="rowacts"><button class="icon-btn" data-caisse-entry-edit="${esc(e.id)}" title="Modifier le mouvement" ${closed ? 'disabled' : ''}>${ICON.edit || '✎'}</button><button class="icon-btn" data-caisse-entry-delete="${esc(e.id)}" title="Supprimer le mouvement" ${closed ? 'disabled' : ''}>${ICON.del}</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><p>Aucun mouvement. Ajoutez une avance, une dépense ou un justificatif.</p></div>'}
      ${v.categorie ? `<p class="hint">Filtre : ${esc(caisseCategoryLabel(v.categorie))} · ${caisseDH(rows.reduce((sum, e) => sum + e.montantCts, 0))}. Le solde du journal reste celui de l’ensemble des mouvements.</p>` : ''}
    </section><div id="caisse-recognition-area">${v.recognition && !closed ? caisseRecognitionHTML(c) : ''}</div>
    <div class="caisse-footer"><button class="btn" id="caisse-close">${closed ? 'Rouvrir la caisse' : 'Clôturer la caisse'}</button>${!S.count ? '<button class="btn danger ghost" id="caisse-delete">Supprimer cette caisse vide</button>' : ''}</div>`;
  $('#caisse-back').onclick = () => { v.id = ''; renderCaisse(); };
  $('#caisse-edit').onclick = () => editCaisseDialog(c);
  $('#caisse-pdf').onclick = () => saveBlob(buildCaissePDF(c, P, stateFor(P.id)), `Etat-caisse-${slug(c.nom)}-${congesTodayISO()}.pdf`);
  $('#caisse-csv').onclick = () => saveBlob(new Blob(['\ufeff' + buildCaisseCSV(c, stateFor(P.id))], { type: 'text/csv;charset=utf-8' }), `Caisse-${slug(c.nom)}-${congesTodayISO()}.csv`);
  $('#caisse-in').onclick = () => caisseEntryDialog(c, 'entree'); $('#caisse-spend').onclick = () => caisseEntryDialog(c);
  $('#caisse-return').onclick = () => caisseEntryDialog(c, 'restitution');
  $('#caisse-recognition').onclick = () => { v.recognition = true; caisseDraft(c.id).input = 'justificatifs'; renderCaisse(); $('#caisse-recognition-area').scrollIntoView?.({ behavior: 'smooth', block: 'start' }); };
  $('#caisse-text').onclick = () => { v.recognition = true; caisseDraft(c.id).input = 'texte'; renderCaisse(); $('#caisse-recognition-area').scrollIntoView?.({ behavior: 'smooth', block: 'start' }); $('#cr-text').focus(); };
  $('#caisse-category-filter').onchange = e => { v.categorie = e.target.value; renderCaisse(); };
  $$('[data-caisse-entry-edit]').forEach(b => b.onclick = () => { const e = DB.caisseEntries.find(e => e.id === b.dataset.caisseEntryEdit && e.profileId === P.id); if(e) caisseEntryDialog(c, e.type, e); });
  $$('[data-caisse-entry-delete]').forEach(b => b.onclick = () => { const id = b.dataset.caisseEntryDelete; dialog('<h3>Supprimer ce mouvement ?</h3><p>Le solde et l’état par typologie seront recalculés.</p><div class="row"><button class="btn" data-close>Annuler</button><button class="btn danger" id="ce-delete-confirm">Supprimer</button></div>'); $('#ce-delete-confirm').onclick = () => { if(deleteCaisseEntry(id)){ closeDialog(); renderCaisse(); toast('Mouvement supprimé.'); } }; });
  $('#caisse-close').onclick = () => { if(closed){ c.statut = 'ouverte'; c.updated = new Date().toISOString(); persistCaisse(P.id); renderCaisse(); return; } dialog(`<h3>Clôturer cette caisse ?</h3><p>Solde : <b>${caisseDH(S.soldeCts)}</b>. Les mouvements resteront consultables et exportables.</p><div class="row"><button class="btn" data-close>Annuler</button><button class="btn primary" id="caisse-close-confirm">Clôturer avec ce solde</button></div>`); $('#caisse-close-confirm').onclick = () => { c.statut = 'cloturee'; c.updated = new Date().toISOString(); persistCaisse(P.id); closeDialog(); renderCaisse(); }; };
  if($('#caisse-delete')) $('#caisse-delete').onclick = () => { DB.deleted[c.id] = new Date().toISOString(); DB.caisses = DB.caisses.filter(x => x !== c); persistCaisse(P.id); v.id = ''; renderCaisse(); };
  if(v.recognition && !closed) bindCaisseRecognition(c);
}

function caisseRecognitionHTML(c){
  const d = caisseDraft(c.id);
  return `<section class="block caisse-recognition"><header><span class="stepn">↗</span><div><h2>Saisie des dépenses · Texte → tableau</h2><p>Décrivez vos dépenses, vérifiez le tableau, puis enregistrez dans cette caisse.</p></div></header>
    <div class="caisse-input-tabs" role="group" aria-label="Source des dépenses"><button class="btn ${d.input !== 'justificatifs' ? 'primary' : ''}" data-caisse-input="texte" aria-pressed="${d.input !== 'justificatifs'}" ${d.busy ? 'disabled' : ''}>Écrire mes dépenses</button><button class="btn ${d.input === 'justificatifs' ? 'primary' : ''}" data-caisse-input="justificatifs" aria-pressed="${d.input === 'justificatifs'}" ${d.busy ? 'disabled' : ''}>Photo / PDF / ticket</button></div>
    ${d.input !== 'justificatifs' ? `<div class="caisse-text-entry"><div class="f"><label for="cr-text">Racontez vos dépenses en une phrase ou collez une liste</label><textarea id="cr-text" rows="6" maxlength="12000" placeholder="Hier, j’ai payé 250 DH de fournitures chez Bricoma, 40 DH pour une course InDrive et 20 DH de pourboire. Aujourd’hui, 600 DH pour la main d’œuvre à Ahmed." ${d.busy ? 'disabled' : ''}>${esc(d.text)}</textarea><p class="hint">Montants en DH · « hier », « aujourd’hui » ou dates précises · plusieurs dépenses séparées par des virgules, des points-virgules ou « et ».</p></div><div class="caisse-actions"><button class="btn primary" id="cr-read" ${d.busy ? 'disabled' : ''}>Transformer le texte en tableau</button><button class="btn ghost" id="cr-example" ${d.busy ? 'disabled' : ''}>Charger un exemple</button><button class="btn ghost" id="cr-reset" ${d.busy ? 'disabled' : ''}>Effacer la préparation</button><span class="caisse-tag">Analyse locale</span></div></div>` : `<div class="caisse-import-grid"><div class="f"><label for="cr-files">Ajouter des justificatifs</label><input id="cr-files" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple ${d.busy ? 'disabled' : ''}><p class="hint">JPG, PNG, WebP, PDF · 5 fichiers, 8 Mo par fichier, 8 pages par PDF. Lecture OCR en français, anglais et arabe.</p>${d.files.length ? `<ul class="caisse-file-list">${d.files.map(f => `<li>${esc(f.file.name)} <small>(${Math.ceil(f.file.size / 1024)} Ko)</small></li>`).join('')}</ul>` : ''}</div><div class="f"><label for="cr-text">Ou coller le texte d’un ticket</label><textarea id="cr-text" rows="4" maxlength="50000" placeholder="Papeterie du Centre&#10;Date : 18/10/2026&#10;TOTAL TTC : 250 DH" ${d.busy ? 'disabled' : ''}>${esc(d.ticketText || '')}</textarea></div></div><div class="caisse-actions"><div class="f"><label for="cr-mode">Interprétation</label><select id="cr-mode" ${d.busy ? 'disabled' : ''}><option value="ticket" ${d.mode === 'ticket' ? 'selected' : ''}>Ticket / facture : retenir le total TTC</option><option value="liste" ${d.mode === 'liste' ? 'selected' : ''}>Liste : une dépense par ligne</option></select></div><button class="btn primary" id="cr-read" ${d.busy ? 'disabled' : ''}>${d.busy ? 'Lecture en cours…' : 'Reconnaître et préparer le tableau'}</button><button class="btn ghost" id="cr-reset" ${d.busy ? 'disabled' : ''}>Effacer la préparation</button></div>`}
    <p class="caisse-message" id="cr-status" role="status" aria-live="polite">${esc(d.status)}</p>
    ${d.notices.length ? `<ul class="caisse-notices">${d.notices.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${d.rows.length ? `<div class="caisse-review-head"><h3>Vérifier avant d’enregistrer</h3><p class="hint">Corrigez les champs proposés et cochez les lignes à enregistrer. Les montants sont en DH. ${d.input === 'justificatifs' ? 'Un ticket est compté une seule fois au total TTC.' : 'Seules les lignes cochées seront enregistrées.'}</p></div><div class="tbl-wrap"><table class="caisse-review"><thead><tr><th>Inclure</th><th>Date</th><th>Typologie</th><th>Libellé</th><th>Bénéficiaire</th><th>Montant DH</th><th>Source</th></tr></thead><tbody>${d.rows.map((r, i) => `<tr class="${r.duplicate ? 'caisse-duplicate' : ''}"><td><input type="checkbox" data-cr-row="${i}" data-cr-key="selected" aria-label="Inclure la ligne ${i + 1}" ${r.selected ? 'checked' : ''} ${d.busy ? 'disabled' : ''}>${r.duplicate ? '<small class="due">Doublon possible</small>' : ''}</td><td><input type="date" value="${esc(r.date)}" data-cr-row="${i}" data-cr-key="date" aria-label="Date ligne ${i + 1}" ${d.busy ? 'disabled' : ''}>${r.dateAConfirmer ? '<small class="due">Date proposée</small>' : ''}</td><td><select data-cr-row="${i}" data-cr-key="categorie" aria-label="Typologie ligne ${i + 1}" ${d.busy ? 'disabled' : ''}>${caisseOptions(r.categorie)}</select></td><td><input value="${esc(r.libelle)}" data-cr-row="${i}" data-cr-key="libelle" maxlength="500" aria-label="Libellé ligne ${i + 1}" ${d.busy ? 'disabled' : ''}>${r.aVerifier ? `<small class="due">${esc(r.aVerifier)}</small>` : ''}</td><td><input value="${esc(r.fournisseur)}" data-cr-row="${i}" data-cr-key="fournisseur" maxlength="200" aria-label="Bénéficiaire ligne ${i + 1}" ${d.busy ? 'disabled' : ''}></td><td><input inputmode="decimal" value="${esc(r.montant)}" data-cr-row="${i}" data-cr-key="montant" aria-label="Montant ligne ${i + 1}" placeholder="À renseigner" ${d.busy ? 'disabled' : ''}></td><td><small>${esc(r.receipt?.name || 'Texte saisi')}</small></td></tr>`).join('')}</tbody></table></div><div class="caisse-actions caisse-review-foot"><strong id="cr-total"></strong><button class="btn leaf" id="cr-save" ${d.busy ? 'disabled' : ''}>Valider et enregistrer les lignes cochées</button></div>` : ''}
    <div class="caisse-actions"><button class="btn small" id="cr-add-row" ${d.busy ? 'disabled' : ''}>+ Ajouter une ligne au tableau</button></div><p class="hint">${d.input === 'justificatifs' ? 'Lecture OCR locale et classement proposé par mots-clés. Les justificatifs sont conservés avec les lignes validées.' : 'Analyse locale des montants, dates et mots-clés. Les formulations ambiguës restent à compléter.'} Aucun enregistrement avant votre validation.</p>
    ${d.files.some(f => f.text) ? `<details><summary>Voir le texte reconnu</summary>${d.files.map(f => `<h4>${esc(f.file.name)}</h4><pre class="caisse-ocr-text">${esc(f.text || '')}</pre>`).join('')}</details>` : ''}
    </section>`;
}
function bindCaisseRecognition(c){
  const d = caisseDraft(c.id);
  $('#cr-text').oninput = e => { if(d.input === 'justificatifs') d.ticketText = e.target.value; else d.text = e.target.value; };
  if($('#cr-mode')) $('#cr-mode').onchange = e => { d.mode = e.target.value; };
  $$('[data-caisse-input]').forEach(b => b.onclick = () => { if(!d.busy){ d.input = b.dataset.caisseInput; renderCaisse(); } });
  if($('#cr-example')) $('#cr-example').onclick = () => { if(d.text.trim()) return toast('Effacez le texte actuel avant de charger cet exemple.'); d.text = 'Hier, j’ai payé 250 DH de fournitures chez Bricoma, 40 DH pour une course InDrive et 20 DH de pourboire. Aujourd’hui, 600 DH pour la main d’œuvre à Ahmed.'; renderCaisse(); };
  if($('#cr-files')) $('#cr-files').onchange = e => {
    const files = [...(e.target.files || [])];
    if(files.length > 5 || files.some(f => f.size > 8 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(f.type))){ d.status = 'Choisissez au plus 5 fichiers JPG, PNG, WebP ou PDF de 8 Mo maximum.'; renderCaisse(); return; }
    d.files = files.map(file => ({ file, id: '', text: '' })); d.mode = 'ticket'; d.rows = []; d.notices = []; d.status = ''; renderCaisse();
  };
  $('#cr-read').onclick = () => d.input === 'justificatifs' ? recognizeCaisse(c) : recognizeCaisseText(c);
  $('#cr-reset').onclick = () => { delete caisseDrafts[P.id + ':' + c.id]; renderCaisse(); };
  $$('[data-cr-row]').forEach(input => { const update = () => { const r = d.rows[+input.dataset.crRow]; r[input.dataset.crKey] = input.dataset.crKey === 'selected' ? input.checked : input.value; if(input.dataset.crKey === 'date') r.dateAConfirmer = false; updateCaisseReviewTotal(d); }; input.oninput = update; input.onchange = update; });
  if($('#cr-save')) $('#cr-save').onclick = () => commitCaisseRecognition(c);
  if($('#cr-add-row')) $('#cr-add-row').onclick = () => { if(d.busy) return; if(d.rows.length >= 100) return toast('Validez ce tableau avant d’ajouter d’autres dépenses.'); d.rows.push({ id: uid(), date: congesTodayISO(), categorie: 'autre', libelle: '', fournisseur: '', montant: '', selected: true, dateAConfirmer: true }); renderCaisse(); };
  updateCaisseReviewTotal(d);
}
function updateCaisseReviewTotal(d){
  const el = $('#cr-total'); if(!el) return;
  const selected = d.rows.filter(r => r.selected), total = selected.reduce((s, r) => s + (caisseCents(r.montant) || 0), 0);
  el.textContent = `${selected.length} ligne(s) cochée(s) · ${caisseDH(total)}`;
}
function stageCaisseRows(c, rows){
  return rows.slice(0, 100).map(r => {
    const duplicate = DB.caisseEntries.some(e => e.profileId === P.id && (r.receipt ? e.justificatif?.id === r.receipt.id : e.caisseId === c.id && e.date === r.date && e.montantCts === r.montantCts && norm(e.libelle) === norm(r.libelle)));
    return { ...r, id: uid(), montant: caisseAmount(r.montantCts), selected: !duplicate, duplicate };
  });
}
function recognizeCaisseText(c){
  const d = caisseDraft(c.id); if(d.busy || c.statut !== 'ouverte') return;
  if(!d.text.trim()){ d.status = 'Écrivez vos dépenses puis cliquez sur « Transformer le texte en tableau ».'; renderCaisse(); return; }
  const result = caisseTextToRows(d.text, { date: congesTodayISO() });
  d.rows = stageCaisseRows(c, result.rows); d.notices = result.notices; d.engine = result.engine;
  d.status = d.rows.length ? `${d.rows.length} dépense(s) proposée(s) par l’analyse locale. Corrigez puis validez les lignes cochées.` : 'Aucune dépense identifiée. Reformulez le texte ou ajoutez une ligne au tableau.';
  renderCaisse();
}
let caisseScriptPromise;
function caisseLoadOCR(){
  if(window.Tesseract) return Promise.resolve(window.Tesseract);
  if(!caisseScriptPromise) caisseScriptPromise = new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = '/caisse-v1/tesseract.min.js'; s.onload = () => resolve(window.Tesseract); s.onerror = () => { caisseScriptPromise = null; s.remove(); reject(Error('Le moteur de lecture n’a pas pu se charger. Réessayez.')); }; document.head.appendChild(s); });
  return caisseScriptPromise;
}
async function caisseImageCanvas(file){
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(Error('Image illisible. Choisissez une photo JPG, PNG ou WebP.')); image.src = src; });
    const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(img, 0, 0, canvas.width, canvas.height); return canvas;
  } finally { URL.revokeObjectURL(src); }
}
async function caissePDFText(file, recognizeImage, progress){
  const pdfjs = await import('/caisse-v1/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/caisse-v1/pdf.worker.min.mjs';
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), cMapUrl: '/caisse-v1/cmaps/', cMapPacked: true, standardFontDataUrl: '/caisse-v1/standard_fonts/', wasmUrl: '/caisse-v1/wasm/', isEvalSupported: false }).promise;
  try {
    if(pdf.numPages > 8) throw Error('Ce PDF dépasse 8 pages. Séparez-le en plusieurs justificatifs.');
    const pages = [];
    for(let i = 1; i <= pdf.numPages; i++){
      progress(`Lecture du PDF · page ${i}/${pdf.numPages}`);
      const page = await pdf.getPage(i), content = await page.getTextContent(), groups = [];
      for(const item of content.items){ if(!item.str?.trim()) continue; const y = Math.round(item.transform[5] / 3) * 3; let line = groups.find(g => g.y === y); if(!line){ line = { y, items: [] }; groups.push(line); } line.items.push({ x: item.transform[4], text: item.str }); }
      let text = groups.sort((a, b) => b.y - a.y).map(g => g.items.sort((a, b) => a.x - b.x).map(x => x.text).join(' ')).join('\n');
      if(text.replace(/\s/g, '').length < 25){
        const viewport = page.getViewport({ scale: Math.min(3, 2200 / page.getViewport({ scale: 1 }).width) }), canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport }).promise;
        text = await recognizeImage(canvas); canvas.width = 1; canvas.height = 1;
      }
      pages.push(text); page.cleanup();
    }
    return pages.join('\n');
  } finally { await pdf.destroy(); }
}
async function recognizeCaisse(c){
  const pid = P.id, epoch = caisseEpoch, d = caisseDraft(c.id), key = pid + ':' + c.id;
  const textInput = d.input === 'justificatifs' ? (d.ticketText || '') : d.text;
  if(d.busy) return;
  if(!d.files.length && !textInput.trim()){ d.status = 'Ajoutez un justificatif ou collez le texte d’un ticket.'; renderCaisse(); return; }
  const alive = () => epoch === caisseEpoch && caisseDrafts[key] === d;
  const progress = msg => { if(!alive()) return; d.status = msg; if(P?.id === pid && currentView === 'caisse' && caisseView().id === c.id && $('#cr-status')) $('#cr-status').textContent = msg; };
  d.busy = true; d.rows = []; d.notices = []; progress('Préparation de la lecture…'); renderCaisse();
  let worker = null;
  try {
    const recognizeImage = async image => {
      if(!alive()) throw Error('Lecture annulée.');
      if(!worker){ const api = await caisseLoadOCR(), base = new URL('/caisse-v1/', location.href).href; worker = await api.createWorker(['fra', 'eng', 'ara'], 1, { workerPath: base + 'worker.min.js', corePath: base + 'core/', langPath: base + 'lang/', workerBlobURL: false, logger: m => { if(m.status === 'recognizing text') progress(`Lecture du justificatif · ${Math.round((m.progress || 0) * 100)} %`); else if(m.status?.includes('load')) progress('Chargement du moteur de lecture…'); } }); await worker.setParameters({ preserve_interword_spaces: '1' }); }
      const result = await worker.recognize(image); if(result.data.confidence < 65) d.notices.push('Lecture peu sûre : vérifiez attentivement les chiffres et la date.'); return result.data.text;
    };
    const proposed = [], date = congesTodayISO(), seenFiles = new Set();
    for(const source of d.files){
      if(!alive()) return;
      progress('Lecture de ' + source.file.name + '…');
      try {
        const bytes = await source.file.arrayBuffer(); source.id = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
        if(seenFiles.has(source.id)){ d.notices.push(source.file.name + ' : ce même justificatif est déjà présent dans la sélection.'); continue; } seenFiles.add(source.id);
        if(!source.text) source.text = source.file.type === 'application/pdf' ? await caissePDFText(source.file, recognizeImage, progress) : await recognizeImage(await caisseImageCanvas(source.file));
        const result = caisseRecognizeText(source.text, { mode: d.mode, date });
        d.notices.push(...result.notices.map(n => source.file.name + ' : ' + n));
        const receipt = { id: source.id, name: source.file.name.slice(0, 180), mime: source.file.type, size: source.file.size };
        result.rows.forEach(r => proposed.push({ ...r, receipt }));
      } catch(error){ if(alive()) d.notices.push(source.file.name + ' : ' + error.message); }
    }
    if(textInput.trim()){ const result = caisseRecognizeText(textInput, { mode: d.mode, date }); proposed.push(...result.rows); d.notices.push(...result.notices); }
    if(!alive()) return;
    d.rows = proposed.slice(0, 100).map(r => {
      const duplicate = DB.caisseEntries.some(e => e.profileId === pid && (r.receipt ? e.justificatif?.id === r.receipt.id : e.caisseId === c.id && e.date === r.date && e.montantCts === r.montantCts && norm(e.libelle) === norm(r.libelle)));
      return { ...r, id: uid(), montant: caisseAmount(r.montantCts), selected: !duplicate, duplicate };
    });
    if(proposed.length > 100) d.notices.push('Import limité à 100 lignes à la fois.');
    d.status = d.rows.length ? `${d.rows.length} ligne(s) proposée(s). Vérifiez puis validez le tableau.` : 'Aucune ligne lisible. Essayez une photo plus nette ou collez le texte.';
  } catch(error){ if(alive()) d.status = error.message; }
  finally { if(worker) await worker.terminate(); if(alive()){ d.busy = false; if(P?.id === pid && currentView === 'caisse') renderCaisse(); } }
}
async function commitCaisseRecognition(c){
  const pid = P.id, epoch = caisseEpoch, key = pid + ':' + c.id, d = caisseDraft(c.id);
  if(d.busy || c.statut !== 'ouverte') return;
  const selected = d.rows.filter(r => r.selected);
  if(!selected.length){ d.status = 'Cochez au moins une ligne à enregistrer.'; renderCaisse(); return; }
  const now = new Date().toISOString(), entries = selected.map(r => ({ id: r.id, profileId: pid, caisseId: c.id, type: 'depense', date: r.date, categorie: r.categorie, libelle: r.libelle.trim(), fournisseur: r.fournisseur.trim(), montantCts: caisseCents(r.montant), justificatif: r.receipt || null, source: r.receipt ? 'ocr' : 'texte', created: now, updated: now }));
  if(entries.some(e => !validCaisseEntry(e, pid))){ d.status = 'Complétez chaque ligne cochée : date valide, libellé et montant positif en DH, avec 2 décimales maximum.'; renderCaisse(); return; }
  d.busy = true; d.status = 'Conservation des justificatifs et des lignes…'; renderCaisse();
  try {
    const receipts = new Map(entries.filter(e => e.justificatif).map(e => [e.justificatif.id, e.justificatif]));
    for(const receipt of receipts.values()){
      if(epoch !== caisseEpoch || caisseDrafts[key] !== d) return;
      const source = d.files.find(f => f.id === receipt.id); if(!source) throw Error('Justificatif manquant. Relancez sa lecture.');
      const response = await fetch(`/api/caisse/receipts/${encodeURIComponent(pid)}/${receipt.id}`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': receipt.mime, 'X-File-Name': encodeURIComponent(receipt.name) }, body: source.file, signal: AbortSignal.timeout(45000) });
      const result = await response.json(); if(!response.ok) throw Error(result.error || 'Justificatif non enregistré. Réessayez.');
    }
    if(epoch !== caisseEpoch || caisseDrafts[key] !== d) return;
    const actual = DB.caisses.find(x => x.id === c.id && x.profileId === pid); if(!actual || actual.statut !== 'ouverte') throw Error('La caisse a été clôturée ou supprimée. Rouvrez-la avant de valider.');
    // Stable draft IDs make a repeated click/retry idempotent.
    const known = new Set(DB.caisseEntries.map(e => e.id)); entries.forEach(e => { if(!known.has(e.id)){ DB.caisseEntries.push(e); known.add(e.id); } });
    persistCaisse(pid); delete caisseDrafts[key];
    await Cloud.flush();
    if(P?.id === pid && epoch === caisseEpoch){ renderCaisse(); toast(Cloud.hasPending ? 'Lignes conservées sur cet appareil. Synchronisation en attente.' : `${entries.length} dépense(s) enregistrée(s).`); }
  } catch(error){ if(epoch === caisseEpoch && caisseDrafts[key] === d) d.status = error.message; }
  finally { if(epoch === caisseEpoch && caisseDrafts[key] === d){ d.busy = false; if(P?.id === pid && currentView === 'caisse') renderCaisse(); } }
}
function buildCaisseCSV(c, state){
  const safe = value => { let s = String(value ?? ''); if(/^[\s]*[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const rows = [['Caisse', 'Projet', 'Ville', 'Profil', 'Date', 'Type', 'Typologie', 'Libellé', 'Bénéficiaire', 'Entrée DH', 'Sortie DH', 'Solde DH', 'Justificatif']];
  caisseStatement(state, c.id).journal.forEach(e => rows.push([c.nom, c.projet, c.ville, state.profile.nom, e.date, CAISSE_TYPES[e.type], e.type === 'depense' ? caisseCategoryLabel(e.categorie) : '', e.libelle, e.fournisseur || '', e.type === 'entree' ? caisseAmount(e.montantCts) : '', e.type !== 'entree' ? caisseAmount(e.montantCts) : '', caisseAmount(e.soldeCts), e.justificatif?.name || '']));
  return rows.map(r => r.map(safe).join(';')).join('\r\n');
}
function buildCaissePDF(c, p, state){
  const S = caisseStatement(state, c.id), doc = newDoc();
  let y = pdfHeader(doc, p, 'ÉTAT DE CAISSE', { lieu: c.ville || p.ville, docDate: congesTodayISO(), numero: '' });
  const info = [`${c.nom} · ${c.projet}`, `${p.nom} · ${c.ville || ''}`, `Ouverture : ${frDate(c.date)} · ${c.statut === 'ouverte' ? 'Ouverte' : 'Clôturée'}`, c.type === 'deplacement' ? 'Déplacement : ' + c.missionLabel : 'Projet sans déplacement'];
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  info.forEach(line => { const lines = doc.splitTextToSize(pdfTxt(line), 178); doc.text(lines, 15, y); y += lines.length * 5; });
  doc.autoTable({ startY: y + 3, margin: { left: 15, right: 15, bottom: 30 }, theme: 'grid', head: [['Avances reçues (DH)', 'Dépenses (DH)', 'Restitué (DH)', 'Solde (DH)']], body: [[S.entreesCts, S.depensesCts, S.restitutionsCts, S.soldeCts].map(v => money(v / 100))], styles: { fontSize: 10, halign: 'right' }, headStyles: { fillColor: BRAND } });
  doc.autoTable({ startY: doc.lastAutoTable.finalY + 8, margin: { left: 15, right: 15, bottom: 30 }, theme: 'grid', head: [['Typologie de dépense', 'Nombre', 'Montant DH']], body: S.categories.map(cat => [pdfTxt(cat.label), String(cat.count), money(cat.montantCts / 100)]), foot: [['TOTAL DÉPENSES', String(S.journal.filter(e => e.type === 'depense').length), money(S.depensesCts / 100)]], styles: { fontSize: 9 }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } }, headStyles: { fillColor: BRAND }, footStyles: { fillColor: BRAND } });
  doc.autoTable({ startY: doc.lastAutoTable.finalY + 9, margin: { left: 10, right: 10, bottom: 30 }, theme: 'grid', head: [['Date', 'Libellé / bénéficiaire', 'Typologie', 'Entrée DH', 'Sortie DH', 'Solde DH', 'Justificatif']],
    body: S.journal.length ? S.journal.map(e => [frDate(e.date), pdfTxt(e.libelle + (e.fournisseur ? '\n' + e.fournisseur : '')), pdfTxt(e.type === 'depense' ? caisseCategoryLabel(e.categorie) : CAISSE_TYPES[e.type]), e.type === 'entree' ? money(e.montantCts / 100) : '', e.type !== 'entree' ? money(e.montantCts / 100) : '', money(e.soldeCts / 100), pdfTxt(e.justificatif?.name || '—')]) : [[{ content: 'Aucun mouvement', colSpan: 7 }]], styles: { fontSize: 7.5, cellPadding: 2 }, columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 46 }, 2: { cellWidth: 27 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { cellWidth: 27 } }, headStyles: { fillColor: BRAND } });
  pdfFooter(doc, p); return doc.output('blob');
}
