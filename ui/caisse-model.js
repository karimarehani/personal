// Shared by the interface, server validation and exports. All money is integer centimes.
export const CAISSE_CATEGORIES = [
  { id: 'fourniture', label: 'Achat fourniture' },
  { id: 'client', label: 'Service client' },
  { id: 'pourboire', label: 'Pourboire' },
  { id: 'course', label: 'Course' },
  { id: 'main-oeuvre', label: 'Main d’œuvre' },
  { id: 'autre', label: 'Autre' }
];
export const CAISSE_TYPES = { entree: 'Avance reçue', depense: 'Dépense', restitution: 'Restitution' };
export function caisseCents(value) {
  let s = String(value ?? '').trim().replace(/[\s\u00a0\u202f]/g, '');
  if (!s || !/^[0-9.,]+$/.test(s)) return NaN;
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) s = s.replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return NaN;
  const [whole, decimal = ''] = s.split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= 1_000_000_000 ? cents : NaN;
}
export function caisseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T12:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value && value >= '2000-01-01' && value <= '2100-12-31';
}
const caisseText = (s, max, required = false) => typeof s === 'string' && s.length <= max && (!required || !!s.trim());
export function validCaisse(c, pid) {
  return !!c && c.profileId === pid && caisseText(c.id, 100, true) && caisseText(c.nom, 160, true) &&
    caisseText(c.projet, 200, true) && caisseText(c.ville || '', 160) && caisseDate(c.date) &&
    ['ouverte', 'cloturee'].includes(c.statut) && ['projet', 'deplacement'].includes(c.type) &&
    (c.type !== 'deplacement' || caisseText(c.missionId, 100, true)) && caisseText(c.missionLabel || '', 300);
}
export function validCaisseReceipt(r) {
  return !!r && /^[a-f0-9]{64}$/.test(r.id) && caisseText(r.name, 180, true) &&
    ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(r.mime) && Number.isInteger(r.size) && r.size > 0 && r.size <= 8 * 1024 * 1024;
}
export function validCaisseEntry(e, pid) {
  return !!e && e.profileId === pid && caisseText(e.id, 100, true) && caisseText(e.caisseId, 100, true) &&
    caisseDate(e.date) && Object.hasOwn(CAISSE_TYPES, e.type) && caisseText(e.libelle, 500, true) &&
    caisseText(e.fournisseur || '', 200) && Number.isSafeInteger(e.montantCts) && e.montantCts > 0 && e.montantCts <= 1_000_000_000 &&
    (e.created === undefined || typeof e.created === 'string') &&
    (e.type !== 'depense' || CAISSE_CATEGORIES.some(c => c.id === e.categorie)) &&
    (!e.justificatif || validCaisseReceipt(e.justificatif));
}
export function caisseStatement(state, caisseId) {
  const caisses = (state.caisses || []).filter(c => c.profileId === state.profile.id && (!caisseId || c.id === caisseId));
  const ids = new Set(caisses.map(c => c.id));
  const rows = (state.caisseEntries || []).filter(e => e.profileId === state.profile.id && ids.has(e.caisseId) && validCaisseEntry(e, state.profile.id))
    .slice().sort((a, b) => a.date.localeCompare(b.date) || (a.created || a.updated || '').localeCompare(b.created || b.updated || '') || ({ entree: 0, depense: 1, restitution: 2 }[a.type] - { entree: 0, depense: 1, restitution: 2 }[b.type]) || a.id.localeCompare(b.id));
  let entreesCts = 0, depensesCts = 0, restitutionsCts = 0, soldeCts = 0;
  const categories = CAISSE_CATEGORIES.map(c => ({ ...c, montantCts: 0, count: 0 }));
  const journal = rows.map(e => {
    if (e.type === 'entree') { entreesCts += e.montantCts; soldeCts += e.montantCts; }
    else if (e.type === 'restitution') { restitutionsCts += e.montantCts; soldeCts -= e.montantCts; }
    else { depensesCts += e.montantCts; soldeCts -= e.montantCts; const cat = categories.find(c => c.id === e.categorie); cat.montantCts += e.montantCts; cat.count++; }
    return { ...e, soldeCts };
  });
  return { entreesCts, depensesCts, restitutionsCts, soldeCts, categories, journal, count: journal.length };
}
const caisseNorm = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe');
export function caisseGuessCategory(text) {
  const t = caisseNorm(text);
  if (/pourboire|tip\b|gratification|بقشيش/.test(t)) return 'pourboire';
  if (/main.?d.?oeuvre|manutention|ouvrier|montage|demontage|technicien|personnel|عمال/.test(t)) return 'main-oeuvre';
  if (/indrive|taxi|course|coursier|livraison|transport|uber|طاكسي/.test(t)) return 'course';
  if (/service.?client|restaurant|restauration|dejeuner|diner|repas|cafe|traiteur|accueil|مطعم/.test(t)) return 'client';
  if (/fourniture|papeterie|achat|materiel|impression|ruban|scotch|stylo|papier|bricolage|librairie/.test(t)) return 'fourniture';
  return 'autre';
}
function caisseReadDate(text, fallback) {
  const iso = text.match(/\b(20\d{2})[-/](\d{2})[-/](\d{2})\b/);
  const fr = text.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](20\d{2})\b/);
  const value = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : fr ? `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}` : '';
  return { date: caisseDate(value) ? value : fallback, assumed: !caisseDate(value) };
}
// A receipt is booked once at its total. A list is booked one line at a time.
// OCR supplies text; these deterministic rules propose fields without inventing missing amounts.
export function caisseRecognizeText(text, options = {}) {
  const source = String(text || '').slice(0, 50_000).replace(/[\u00a0\u202f\u066c]/g, ' ').replace(/\u066b/g, '.').replace(/[\u0660-\u0669\u06f0-\u06f9]/g, c => String(c.charCodeAt(0) - (c.charCodeAt(0) >= 0x6f0 ? 0x6f0 : 0x660)));
  const lines = source.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const fallback = options.date || new Date().toISOString().slice(0, 10), mode = options.mode === 'liste' ? 'liste' : 'ticket';
  const headerDate = caisseReadDate(source, fallback), notices = [];
  const foreign = /\b(?:EUR|USD|GBP|euro|dollar)s?\b|[€$£]/i.test(source);
  if (foreign) notices.push('Devise étrangère détectée : saisissez le montant converti en DH avant validation.');
  const amountAtEnd = line => {
    const match = line.match(/(?:^|[\s:;=|])([0-9]+(?:[ .][0-9]{3})*(?:[.,][0-9]{1,2})?)\s*(?:MAD|DHS?|DIRHAMS?|درهم|EUR|USD|€|\$)?\s*$/i);
    if (!match) return null;
    const amount = caisseCents(match[1].replace(/\.(?=\d{3}(?:\D|$))/g, ''));
    return Number.isFinite(amount) && amount > 0 ? { amount, prefix: line.slice(0, match.index).trim().replace(/[:;=|\s]+$/, '') } : null;
  };
  const ignore = line => /^(?:tel|telephone|fax|ice\b|if\b|rc\b|patente|tva\b|taxe\b|total\s*(?:ht\b|hors\b|h\.t)|sous.?total|sub.?total|monnaie|rendu|especes|carte bancaire|cb\b|remise|quantite|qte\b)/i.test(caisseNorm(line));
  const total = line => !/^total\s*(?:ht\b|hors\b|h\.t)/i.test(caisseNorm(line)) && /^(?:total(?:\s+(?:ttc|general|a\s+payer))?|net\s+a\s+payer|montant\s+(?:ttc|total)|a\s+payer)\b|^(?:المجموع|الاجمالي)/i.test(caisseNorm(line));
  const vendor = String(options.fournisseur || lines.find(line => /[a-zÀ-ÿ\u0600-\u06ff]/i.test(line) && !ignore(line) && !total(line) && !caisseReadDate(line, '').date && !amountAtEnd(line)) || '').slice(0, 200);
  let rows = [];
  if (mode === 'liste') {
    for (const line of lines) {
      if (ignore(line) || total(line)) continue;
      const amount = amountAtEnd(line); if (!amount || !/[a-zÀ-ÿ\u0600-\u06ff]/i.test(amount.prefix)) continue;
      const d = caisseReadDate(line, headerDate.date);
      const label = amount.prefix.replace(/\b20\d{2}[-/]\d{2}[-/]\d{2}\b|\b\d{1,2}[/.\-]\d{1,2}[/.\-]20\d{2}\b/g, '').replace(/^[\s;|•\-*]+/, '').trim();
      rows.push({ date: d.date, libelle: label.slice(0, 500) || 'Dépense à préciser', fournisseur: '', categorie: caisseGuessCategory(line), montantCts: foreign ? null : amount.amount, dateAConfirmer: d.assumed && headerDate.assumed });
    }
    if (!rows.length) notices.push('Aucune ligne avec un montant fiable. Complétez la proposition ou corrigez le texte.');
  } else {
    const candidates = lines.filter(total).map(line => ({ line, ...amountAtEnd(line) })).filter(c => Number.isSafeInteger(c.amount));
    // Prefer net à payer / TTC; the final matching line wins on multi-page receipts.
    const priority = line => /net\s+a\s+payer|total\s+a\s+payer|montant\s+ttc|total\s+ttc/i.test(caisseNorm(line)) ? 2 : 1;
    candidates.sort((a, b) => priority(a.line) - priority(b.line));
    const chosen = candidates.at(-1);
    const unique = !chosen ? lines.filter(line => !/^(?:tel|telephone|fax|ice\b|if\b|rc\b|patente)/i.test(caisseNorm(line))).map(line => ({ line, ...amountAtEnd(line) })).filter(x => x.amount) : [];
    const amount = chosen?.amount ?? (unique.length === 1 && !ignore(unique[0].line) ? unique[0].amount : null);
    if (!amount) notices.push('Montant total non identifié : renseignez-le dans le tableau.');
    rows = [{ date: headerDate.date, libelle: (vendor ? 'Ticket · ' + vendor : 'Justificatif à préciser').slice(0, 500), fournisseur: vendor, categorie: caisseGuessCategory(source), montantCts: foreign ? null : amount, dateAConfirmer: headerDate.assumed }];
  }
  if (!rows.length) rows = [{ date: headerDate.date, libelle: '', fournisseur: vendor, categorie: caisseGuessCategory(source), montantCts: null, dateAConfirmer: headerDate.assumed }];
  if (headerDate.assumed) notices.push('Date non reconnue : la date du jour est proposée et reste à vérifier.');
  if (rows.length > 100) notices.push('Seules les 100 premières lignes sont proposées.');
  return { rows: rows.slice(0, 100), notices, mode };
}

// Local free-text fallback: actual amounts/dates only, with an explicit review step.
// This parser does not claim to be a generative AI service.
export function caisseTextToRows(text, options = {}) {
  const source = String(text || '').slice(0, 12000).replace(/[\u00a0\u202f\u066c]/g, ' ').replace(/\u066b/g, '.').replace(/[\u0660-\u0669\u06f0-\u06f9]/g, c => String(c.charCodeAt(0) - (c.charCodeAt(0) >= 0x6f0 ? 0x6f0 : 0x660)));
  const fallback = caisseDate(options.date) ? options.date : new Date().toISOString().slice(0, 10), notices = [], rows = [];
  const months = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
  function readDate(value, inherited) {
    const t = caisseNorm(value), full = caisseReadDate(value, ''), year = fallback.slice(0, 4);
    if(full.date) return { date: full.date, assumed: false };
    const relative = /\bavant[- ]hier\b/.test(t) ? -2 : /\bapres[- ]demain\b/.test(t) ? 2 : /\bhier\b/.test(t) ? -1 : /\bdemain\b/.test(t) ? 1 : /aujourd['’ ]?hui/.test(t) ? 0 : null;
    if(relative !== null){ const d = new Date(fallback + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + relative); return { date: d.toISOString().slice(0, 10), assumed: false }; }
    const named = t.match(/\b(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(20\d{2}))?\b/);
    const short = t.match(/\b(\d{1,2})\/(\d{1,2})(?![\/\d])/);
    const date = named ? `${named[3] || year}-${String(months.indexOf(named[2]) + 1).padStart(2, '0')}-${named[1].padStart(2, '0')}` : short ? `${year}-${short[2].padStart(2, '0')}-${short[1].padStart(2, '0')}` : '';
    if(date && caisseDate(date)) return { date, assumed: named ? !named[3] : true };
    return inherited;
  }
  function maskDates(value) {
    return value.replace(/\b20\d{2}[-/]\d{2}[-/]\d{2}\b|\b\d{1,2}[/.\-]\d{1,2}[/.\-](?:20)?\d{2}\b|\b\d{1,2}\/\d{1,2}\b|\b\d{1,2}\s+(?:janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)(?:\s+20\d{2})?\b|\b\d{1,2}:\d{2}\b/gi, m => ' '.repeat(m.length));
  }
  const amountPattern = /\b\d+(?:[ .]\d{3})*(?:[.,]\d{1,2})?\s*(?:MAD\b|DHS?\b|dirhams?\b|درهم|EUR\b|USD\b|euros?\b|dollars?\b|[€$£])?/gi;
  function amounts(value) {
    const masked = maskDates(value), found = [];
    for(const m of masked.matchAll(amountPattern)) {
      const token = m[0].trim(), raw = token.match(/^\d[\d .,]*/)?.[0].trim() || '', currency = token.slice(raw.length).trim();
      const before = caisseNorm(value.slice(0, m.index)), after = caisseNorm(value.slice(m.index + m[0].length));
      if(!currency && (/^\s*(?:x|×|\*|ouvriers?\b|personnes?\b|techniciens?\b|heures?\b|jours?\b|pieces?\b)/.test(after) || /^\d{9,}$/.test(raw) || /(?:tel|telephone|ice|rue|code postal)\s*[:=]?\s*$/.test(before))) continue;
      const context = currency || !after.trim() || /(?:paye|regle|verse|donne|depense|montant|cout|prix)\s*(?:de\s*)?$/.test(before) || /^\s*(?:pour|de|d['’]|en|chez|a|à|au)\b/.test(after);
      if(!context) continue;
      const cents = caisseCents(raw.replace(/\.(?=\d{3}(?:\D|$))/g, ''));
      const negative = /-\s*$/.test(before);
      found.push({ start: m.index, end: m.index + m[0].length, raw, cents: !negative && Number.isSafeInteger(cents) && cents > 0 ? cents : null, negative, foreign: !!currency && /EUR|USD|euro|dollar|[€$£]/i.test(currency) });
    }
    return found;
  }
  const chunks = source.replace(/,(?!\d)|(?<!\d),/g, '\n').replace(/(?<!\d)\.(?=\s|$)|\.(?!\d)(?=\s)/g, '\n').split(/[\n;]+/).map(s => s.trim()).filter(Boolean);
  let inherited = { date: fallback, assumed: true };
  for(const chunk of chunks) {
    const parts = chunk.split(/\s+(?:et|puis|ensuite|ainsi que)\s+/i), segments = [];
    for(const part of parts) {
      const previous = segments.at(-1);
      if(previous && (!amounts(previous).length || !amounts(part).length)) segments[segments.length - 1] += ' et ' + part;
      else segments.push(part);
    }
    for(const segment of segments) {
      inherited = readDate(segment, inherited);
      const t = caisseNorm(segment), candidates = amounts(segment);
      if(/^(?:total\b|sous[- ]?total\b|net a payer\b|tva\b|taxe\b|solde\b)/.test(t)) continue;
      if(/(?:avance\s+recue|recu[^.;]*\bavance\b|on m['’]a remis|fonds?\s+recus?|restitu[eé]|remboursement\s+recu|m['’]a rembourse|rendu\s+(?:au|a la)\s+bureau)/.test(t)) { notices.push('Une avance, un remboursement reçu ou une restitution a été repéré et écarté des dépenses. Utilisez les mouvements d’entrée ou de restitution de caisse.'); continue; }
      const category = caisseGuessCategory(segment), hasExpense = category !== 'autre' || /achat|depense|paye|regle|verse|donne|facture/.test(t);
      if(!candidates.length && !hasExpense) continue;
      let amount = candidates.length === 1 ? candidates[0].cents : null, warning = '';
      if(candidates.length > 1) warning = 'Plusieurs montants : précisez le total de cette dépense.';
      else if(!amount) warning = 'Montant non reconnu : à renseigner.';
      if(candidates.some(a => a.foreign)){ amount = null; warning = 'Devise étrangère : saisissez le montant converti en DH.'; }
      if(candidates.some(a => a.negative)){ amount = null; warning = 'Montant négatif : vérifiez le sens du mouvement avant de saisir un montant positif.'; }
      let clean = maskDates(segment);
      for(const a of [...candidates].reverse()) clean = clean.slice(0, a.start) + ' '.repeat(a.end - a.start) + clean.slice(a.end);
      if(candidates.length === 1 && amount) {
        const before = t.slice(0, candidates[0].start), quantity = before.match(/\b(\d{1,3})\s*(?:x|×|\*)\s*$/) || (/\b(?:chacun|chacune|piece|unitaire|par personne)\b/.test(t) ? before.match(/\b(\d{1,3})\s+(?:ouvriers?|personnes?|techniciens?|pieces?|rallonges?|cables?|repas)\b/) : null);
        if(quantity && Number(quantity[1]) > 0) { const q = Number(quantity[1]), sum = amount * q; if(Number.isSafeInteger(sum) && sum <= 1_000_000_000){ amount = sum; notices.push(`${q} × ${candidates[0].raw} DH : total calculé à vérifier.`); clean = clean.replace(/\b\d{1,3}\s*(?:x|×|\*)\s*/i, ''); } else { amount = null; warning = 'Montant total trop élevé : à vérifier.'; } }
      }
      const vendorMatch = clean.match(/\b(?:chez|aupr[eè]s de)\s+(.+?)(?=\s+(?:pour|avec|en)\b|$)/i);
      let vendor = vendorMatch?.[1]?.trim() || '';
      if(!vendor) {
        const person = clean.match(/(?:pay[eé]+|vers[eé]+|donn[eé]+|remis)\s+(?:a|à)\s+([A-ZÀ-Ý][\p{L}'’\-]+(?:\s+[A-ZÀ-Ý][\p{L}'’\-]+){0,2})(?=\s+pour\b|$)/u) || (['main-oeuvre','pourboire'].includes(category) ? clean.match(/(?:a|à)\s+([A-ZÀ-Ý][\p{L}'’\-]+(?:\s+[A-ZÀ-Ý][\p{L}'’\-]+){0,2})(?=\s+pour\b|$)/u) : null);
        vendor = person?.[1] || '';
      }
      if(vendorMatch) clean = clean.replace(vendorMatch[0], '');
      clean = clean.replace(/\b(?:avant[- ]hier|apr[eè]s[- ]demain|hier|demain|aujourd['’ ]?hui)\b/gi, '').replace(/^\s*(?:le\s*)?[:\-–]?\s*/, '').replace(/^\s*(?:j['’]ai\s+|nous avons\s+|on a\s+)?(?:achet[eé]|pay[eé]|r[eé]gl[eé]|d[eé]pens[eé]|donn[eé]|vers[eé])\s*/i, '').replace(/^\s*(?:(?:pour|de|du|des|la|le|les)\s+|d['’])+/i, '').replace(/\s+/g, ' ').replace(/^[\s:|\-–]+|[\s:|\-–]+$/g, '').trim();
      rows.push({ date: inherited.date, dateAConfirmer: inherited.assumed, categorie: category, libelle: (clean || segment).slice(0, 500), fournisseur: vendor.slice(0, 200), montantCts: amount, aVerifier: warning });
      if(warning) notices.push(warning);
    }
  }
  if(rows.some(r => r.dateAConfirmer)) notices.push('Date absente ou année non précisée : vérifiez la date proposée.');
  if(!rows.length && source.trim()) notices.push('Aucune dépense identifiée. Essayez « taxi 40 DH, fournitures 250 DH », ou ajoutez une ligne au tableau.');
  if(String(text || '').length > 12000) notices.push('Texte limité à 12 000 caractères.');
  if(rows.length > 100) notices.push('Seules les 100 premières dépenses sont proposées.');
  return { rows: rows.slice(0, 100), notices: [...new Set(notices)], mode: 'texte', engine: 'local' };
}
