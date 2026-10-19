const fs = require('fs');
const vm = require('vm');
const model = fs.readFileSync(__dirname + '/../ui/conges-model.js', 'utf8').replace(/^export /gm, '');
const html = fs.readFileSync(__dirname + '/../ui/tool.html', 'utf8').replace('/*__CONGES_MODEL__*/', () => model)
  .replace('/*__CAISSE_MODEL__*/', () => fs.readFileSync(__dirname + '/../ui/caisse-model.js', 'utf8').replace(/^export /gm, ''))
  .replace('/*__CAISSE_UI__*/', () => fs.readFileSync(__dirname + '/../ui/caisse-ui.js', 'utf8'))
  .replace('/*__REPAS_MODEL__*/', () => fs.readFileSync(__dirname + '/../ui/repas-model.js', 'utf8').replace(/^export /gm, ''))
  .replace('/*__REPAS_UI__*/', () => fs.readFileSync(__dirname + '/../ui/repas-ui.js', 'utf8'))
  .replace('/*__LETTERHEADS_MODEL__*/', () => fs.readFileSync(__dirname + '/../ui/letterheads-model.js', 'utf8').replace(/^export /gm, ''))
  .replace('/*__LETTERHEADS_ASSETS__*/', () => fs.readFileSync(__dirname + '/../ui/letterheads-assets.js', 'utf8').replace(/^export /gm, ''))
  .replace('/*__ADMIN_UI__*/', () => fs.readFileSync(__dirname + '/../ui/admin-ui.js', 'utf8'))
  .replace('/*__MOBILE_UI__*/', () => fs.readFileSync(__dirname + '/../ui/mobile-ui.js', 'utf8'));
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const nodes = new Map(), timers = new Map(); let tid = 0;
function el(tag='div') { return {tagName:tag.toUpperCase(),style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},value:'',innerHTML:'',textContent:'',addEventListener(){},removeEventListener(){},querySelector(s){return node(s)},querySelectorAll(){return []},appendChild(){},remove(){},focus(){},select(){},setAttribute(){},getAttribute(){return null},click(){},showModal(){},close(){},getContext(){return null}}; }
function node(s) { if (!nodes.has(s)) nodes.set(s,el()); return nodes.get(s); }
const storage = () => {const m=new Map();return {getItem(k){return m.get(k)||null},setItem(k,v){m.set(k,String(v))},removeItem(k){m.delete(k)},clear(){m.clear()}}};
const ctx={console,crypto:require("node:crypto").webcrypto,AbortSignal,Blob,URL,ArrayBuffer,Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array,TextEncoder,TextDecoder,Promise,Date,Math,JSON,RegExp,Error,Map,Set,Buffer,
 atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64'),
 localStorage:storage(),sessionStorage:storage(), navigator:{userAgent:'Node audit'},location:{href:'file:///audit.html'},
 mobileViewport:{matches:false,addEventListener(){}},matchMedia(){return this.mobileViewport},
 document:{querySelector:node,querySelectorAll(){return []},addEventListener(){},visibilityState:'visible',createElement:el,createElementNS:(n,t)=>el(t),body:el('body')},
 setTimeout(fn,ms){const id=++tid;timers.set(id,fn);return id},clearTimeout(id){timers.delete(id)},setInterval(){return 0},clearInterval(){},
 addEventListener(){},removeEventListener(){},scrollTo(){},fetch:async()=>{throw Error('No network in audit')},
 Image:class{},XMLHttpRequest:class{},XMLSerializer:class{},MouseEvent:class{}
}; ctx.window=ctx;ctx.self=ctx;ctx.globalThis=ctx;
vm.createContext(ctx);
for(let i=0;i<scripts.length;i++) {
 let s=scripts[i]; if(s.includes('/* ================= Démarrage')) s=s.slice(0,s.indexOf('/* ================= Démarrage'));
 vm.runInContext(s,ctx,{filename:'embedded-'+i+'.js'});
}
const run=s=>vm.runInContext(s,ctx);
const assert=require('node:assert/strict');
run(`const renderEditorMobileAudit=renderEditor,renderDashMobileAudit=renderDash;load();P=DB.profiles[0];renderEditor=()=>{};renderHist=()=>{};renderDash=()=>{};updateLegMeta=()=>{};toast=()=>{};`);
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e.message);process.exitCode=1}}
run(`const fixture=(date='2026-10-12',retour=date)=>({...newMission(date),retour,objet:'Mission test',projet:'Projet test',destination:'Marrakech',numero:'OM-KR-2026-001',statut:'généré',repasMode:'forfait',repasParJour:{},repasJour:250,repasJours:daysBetween(date,retour),ar:{...newAR(),dep:{label:'Casablanca',lat:33.57,lon:-7.59},arr:{label:'Marrakech',lat:31.63,lon:-8.01},km:250,peage:80},trajets:[],hebergements:[],autres:[]});`);
check('exactly five named profiles',()=>assert.deepEqual(JSON.parse(run('JSON.stringify(DB.profiles.map(p=>p.id))')),['karima','wijdane','samir','reda','amine']));
check('Samir and Wijdane use the supplied letterheads while other profiles retain Blue Chili',()=>assert.equal(run(`(()=>{const k=DB.profiles.find(p=>p.id==='karima'),s=DB.profiles.find(p=>p.id==='samir'),w=DB.profiles.find(p=>p.id==='wijdane');return s.societe.nom==='Apollo Prod'&&w.societe.nom==='Brendz Agency'&&w.societe.footer.length===4&&k.societe.nom==='Blue Chili'&&logoOf(s).startsWith('data:image/png;')&&logoOf(w).startsWith('data:image/png;')})()`),true));
check('old profile snapshots cannot restore the previous company for document exports',()=>assert.equal(run(`(()=>{const p={...DB.profiles.find(p=>p.id==='samir'),societe:DB.profiles[0].societe};const m={...fixture(),profileId:'samir'};const pdf=buildOM(m,p).output();return pdf.includes('APOLLO')&&pdf.includes('PROD')&&pdf.includes('003379948000071')&&!pdf.includes('001992467000076')})()`),true));
check('leave accrual begins in September and credits only completed months',()=>{assert.equal(run(`congesSummary(stateFor('karima'),'2026-09-29').acquis`),0);assert.equal(run(`congesSummary(stateFor('karima'),'2026-09-30').acquis`),1.5);assert.equal(run(`congesSummary(stateFor('karima'),'2026-10-14').acquis`),1.5);assert.equal(run(`congesSummary(stateFor('karima'),'2026-10-31').acquis`),3);assert.equal(run(`congesSummary(stateFor('karima'),'2026-12-31').acquis`),6)});
check('all three eligible profiles accrue leave while Reda has no counter',()=>{assert.ok(['karima','wijdane','samir'].every(id=>run(`congesSummary(stateFor('${id}'),'2026-10-14').acquis`)===1.5));assert.equal(run(`congesSummary(stateFor('reda'),'2026-10-14')`),null)});
check('leave balance separates future days, half days and other profiles',()=>assert.equal(run(`(()=>{DB.conges=[{id:'half',profileId:'karima',date:'2026-10-12',jours:0.5},{id:'later',profileId:'karima',date:'2026-11-12',jours:2},{id:'other-leave',profileId:'samir',date:'2026-10-12',jours:1}];const C=congesSummary(stateFor('karima'),'2026-10-14');DB.conges=[];return C.pris===0.5&&C.prevus===2&&C.solde===1&&C.soldeApresPrevus===-1})()`),true));
check('leave carries forward into a new year instead of resetting',()=>assert.equal(run(`(()=>{const s=stateFor('karima');s.conges=[{id:'half',profileId:'karima',date:'2026-10-12',jours:0.5}];const C=congesSummary(s,'2027-01-14');return C.report===5.5&&C.acquis===6&&C.solde===5.5})()`),true));
check('leave month end handles leap years and Casablanca date',()=>{assert.equal(run(`congesSummary(stateFor('karima'),'2028-02-28').acquis`),25.5);assert.equal(run(`congesSummary(stateFor('karima'),'2028-02-29').acquis`),27);assert.equal(run(`congesTodayISO(new Date('2026-09-30T23:30:00Z'))`),'2026-10-01')});
check('new missions have three unchecked meals per day and no automatic meal claim',()=>assert.equal(run(`(()=>{const m=newMission('2026-10-19');m.retour='2026-10-21';const R=repasSummary(m);return R.daily&&R.days.length===3&&R.total===0&&R.selectionCount===0})()`),true));
check('daily meals update reimbursements and the separate summary subtotals',()=>assert.equal(run(`(()=>{cur=newMission('2026-10-19');cur.transport='Sans transport';cur.retour='2026-10-20';cur.repasParJour={'2026-10-19':{petitDejeuner:true,dejeuner:true,diner:true},'2026-10-20':{dejeuner:true}};cur.avance=100;cur.paiements=[{montant:50,date:'2026-10-21'}];refreshSummary();return totals(cur).repas===350&&settlement(cur).due===200&&$('#s-dl').innerHTML.includes('Petit-déjeuner (1 × 50 DH)')&&$('#s-dl').innerHTML.includes('Déjeuner (2 × 100 DH)')})()`),true));
check('per-day meal controls save an otherwise empty mission immediately',()=>assert.equal(run(`(()=>{DB.missions=[];cur=newMission('2026-10-19');cur.transport='Sans transport';renderRepas();const box=$('#repas-ui');const input={dataset:{repasDate:'2026-10-19',repasKey:'petitDejeuner'},checked:true};box.onchange({target:{closest:()=>input}});return DB.missions.includes(cur)&&cur.repasParJour[cur.depart].petitDejeuner&&$('#repas-total').textContent==='50,00 DH'&&box.innerHTML.includes('Déjeuner<small>100 DH')})()`),true));
check('old mission keeps its original meal claim until explicit conversion and can revert',()=>assert.equal(run(`(()=>{cur=fixture();delete cur.repasMode;delete cur.repasParJour;renderRepas();const before=totals(cur).repas;$('#repas-daily').onclick();const converted=totals(cur).repas;$('#repas-legacy').onclick();return before===250&&converted===0&&totals(cur).repas===250})()`),true));
check('duplicate shifts selected meals along with mission dates',()=>assert.equal(run(`(()=>{DB.missions=[];const m=newMission('2026-09-12');m.retour='2026-09-13';m.repasParJour={'2026-09-12':{petitDejeuner:true},'2026-09-13':{dejeuner:true,diner:true}};duplicate(m);const c=DB.missions[0];return c.repasParJour[c.depart].petitDejeuner&&c.repasParJour[c.retour].diner&&totals(c).repas===250})()`),true));
check('meal selections survive an older browser snapshot including the active editor',()=>assert.equal(run(`(()=>{cur=fixture();delete cur.repasMode;delete cur.repasParJour;DB.missions=[cur];const remote=stateFor(P.id);remote.missions=[{...cur,repasMode:'journalier',repasParJour:{[cur.depart]:{diner:true}}}];applyRemote(remote);return cur.repasMode==='journalier'&&totals(cur).repas===100&&profileBackup(P.id).missions[0].repasParJour[cur.depart].diner})()`),true));
check('French amounts preserve thousands and cents',()=>assert.equal(run(`num('1 000,50')+num('1.000,50')+num('1\u00a0000,50')`),3001.5));
check('ordinary car mission totals',()=>assert.equal(run(`(()=>{const m=fixture('2026-10-12','2026-10-13');m.trajets=[{id:'x',date:m.depart,dep:{label:'H'},arr:{label:'E'},km:20,peage:0}];m.dayMode={'2026-10-13':{same:true,ref:m.depart}};return totals(m).total})()`),2280));
check('train does not claim car indemnities or tolls',()=>assert.equal(run(`(()=>{const m=fixture();m.transport='Train';return totals(m).fraisKm+totals(m).peage})()`),0));
check('no transport ignores stale routes while preserving other expenses',()=>assert.equal(run(`(()=>{const m=fixture();m.transport='Sans transport';m.ar.montant=300;m.ar.montantRetour=400;m.trajets=[{id:'old',date:m.depart,dep:{label:'A'},arr:{label:'B'},km:50,peage:20,montant:60}];m.autres=[{montant:25}];m.hebergements=[{paye:200,payeur:'moi'}];const T=totals(m);return T.total===475&&T.km===0&&T.peage===0&&T.train===0&&T.inDrive===0&&allLegs(m).length===0})()`),true));
check('no transport hides all cost and location controls',()=>assert.equal(run(`(()=>{cur=fixture();cur.transport='Sans transport';const row=legRow(cur.ar,'ar');return !row.includes('data-l=')&&!row.includes('data-p=')&&row.includes('Sans transport')})()`),true));
check('train counts separately priced outward and return tickets',()=>assert.equal(run(`(()=>{const m=fixture();m.transport='Train';m.ar.montant='130,50';m.ar.montantRetour=150;const T=totals(m);return T.train+T.km+T.inDrive})()`),280.5));
check('one-way InDrive excludes unused return amount',()=>assert.equal(run(`(()=>{const m=fixture();m.transport='InDrive';m.ar.ret=false;m.ar.montant=300;m.ar.montantRetour=450;return totals(m).inDrive})()`),300));
check('train and InDrive amounts count without mandatory station names',()=>assert.equal(run(`(()=>{const m=fixture();m.transport='Train';m.ar.dep={label:''};m.ar.arr={label:''};m.ar.montant=130;m.ar.montantRetour=150;m.trajets=[{id:'ride',date:m.depart,transport:'InDrive',dep:{label:''},arr:{label:''},montant:60}];return totals(m).train+totals(m).inDrive})()`),340));
check('mixed train and car legs reimburse each appropriate cost',()=>assert.equal(run(`(()=>{const m=fixture();m.transport='Train';m.ar.montant=100;m.ar.montantRetour=120;m.trajets=[{id:'car',date:m.depart,transport:'Voiture',dep:{label:'A'},arr:{label:'B'},km:10,peage:5},{id:'ride',date:m.depart,transport:'InDrive',dep:{label:'B'},arr:{label:'C'},montant:'45,50'}];const T=totals(m);return T.fraisKm+T.peage+T.train+T.inDrive})()`),300.5));
check('company paid InDrive is excluded from reimbursement',()=>assert.equal(run(`(()=>{const m=fixture();m.transport='InDrive';m.ar.payeur='societe';m.ar.montant=300;m.ar.montantRetour=400;return totals(m).inDrive})()`),0));
check('adding InDrive return does not copy outward fare',()=>assert.equal(run(`(()=>{cur=fixture();return reverseLeg({id:'ride',dep:{label:'A'},arr:{label:'B'},transport:'InDrive',montant:40}).montant})()`),''));
check('fare controls replace car costs for train and InDrive',()=>assert.equal(run(`(()=>{cur=fixture();cur.transport='Train';const row=legRow(cur.ar,'ar');return row.includes('data-l="montant"')&&row.includes('data-l="montantRetour"')&&!row.includes('data-l="km"')&&!row.includes('data-l="peage"')})()`),true));
check('numeric GPS accepts negative longitude and rejects invalid latitude',()=>assert.equal(run(`parseGmaps('33, -7').lon===-7&&parseGmaps('91, -7')===null`),true));
check('short and complete Google Maps links use server resolution',()=>assert.equal(run(`parseGmaps('https://maps.app.goo.gl/example').short&&!!parseGmaps('https://www.google.com/maps/place/Marrakech/@31.62,-8.01,12z').url`),true));
check('company vehicle does not claim personal car rate',()=>assert.equal(run(`(()=>{const m=fixture();m.transport='Véhicule de société';return totals(m).fraisKm})()`),0));
check('duplicate resets payment and advance and shifts daily legs',()=>assert.equal(run(`(()=>{DB.missions=[];const m=fixture('2026-09-12','2026-09-13');m.rembourse=true;m.avance=500;m.trajets=[{id:'old',date:m.depart,dep:{label:'H'},arr:{label:'E'},km:20,peage:0}];duplicate(m);const c=DB.missions[0];return !c.rembourse&&c.avance===0&&c.paiements.length===0&&c.depart===todayISO()&&c.trajets[0].date===c.depart&&!!c.numero})()`),true));
check('same Saturday counts once across overlapping missions',()=>assert.equal(run(`(()=>{DB.missions=[fixture('2026-10-10'),fixture('2026-10-10')];DB.recups=[];return dashData(2026).acquis})()`),1));
check('recovery carries forward between years',()=>assert.equal(run(`(()=>{DB.missions=[fixture('2025-12-27','2025-12-28')];DB.recups=[{id:'r1',profileId:P.id,date:'2026-01-12',jours:1}];const d=dashData(2026);return d.report+d.acquis-d.pris})()`),1));
check('drafts excluded from pending reimbursements',()=>assert.equal(run(`(()=>{const m=fixture();m.statut='brouillon';DB.missions=[m];DB.recups=[];return dashData(2026).S.att})()`),0));
check('payment follows actual payment month',()=>assert.equal(run(`(()=>{const m=fixture();m.paiements=[{id:'p1',date:'2026-12-10',montant:500}];DB.missions=[m];return dashData(2026).months[11].rb})()`),500));
check('partial payment leaves correct balance',()=>assert.equal(run(`(()=>{const m=fixture();m.paiements=[{id:'p1',date:'2026-10-14',montant:500}];return settlement(m).due})()`),1410));
check('personal backup excludes other profiles',()=>assert.equal(run(`(()=>{DB.missions=[fixture(),{...fixture(),id:'other',profileId:'samir'}];DB.recups=[];return profileBackup('karima').missions.length})()`),1));
check('new mission is saved before navigation',()=>assert.equal(run(`(()=>{DB.missions=[];cur=newMission('2026-10-12');cur.objet='New';changed();go('new','2026-10-13');return DB.missions.length})()`),1));
check('hotel manual total is checked against nightly cap',()=>assert.equal(run(`(()=>{P.baremeHotel=[{zone:'Marrakech',plafond:800}];return baremeLine({ville:'Marrakech',nuits:2,total:2000,totalManuel:true,prixNuit:''}).includes('dépassement')})()`),true));
check('sync preserves active settings object for further edits',()=>assert.equal(run(`(()=>{const ref=P;applyRemote(stateFor(P.id));return P===ref})()`),true));
check('out of period daily routes do not increase mission claim',()=>assert.equal(run(`(()=>{const m=fixture('2026-11-12');m.trajets=[{id:'old',date:'2026-10-12',dep:{label:'A'},arr:{label:'B'},km:20,peage:0}];return totals(m).kmJour})()`),0));
(async()=>{
 run(`cur=fixture();cur.transport='Sans transport';cur.ar._autoReturn=true;`);await run('recompute(cur.ar)');
 check('no transport does not call the router or add a return route',()=>assert.equal(run('cur.trajets.length===0&&cur.ar._autoReturn===false'),true));
 const gps=await run('placeFromGmaps({lat:31.623871,lon:-8.014418,name:"Mövenpick Marrakech"})');
 check('GPS and Maps points resolve without reverse-geocoding network call',()=>assert.equal(gps.lat,31.623871));
 run(`const savedFavs=P.favoris;P.favoris=[{label:'Bureau Blue Chili',adresse:'Villa Brion',lat:33.5927184,lon:-7.6232772}];const officePoint={label:'Bureau Blue Chili'};`);await run('ensureCoords(officePoint)');
 check('saved departure coordinates are reused without geocoding',()=>assert.equal(run('officePoint.lat'),33.5927184));
 run('P.favoris=savedFavs;');
 run(`cur=fixture();cur.ar.dep={label:'Bureau Blue Chili'};const savedEnsure=ensureCoords;ensureCoords=async()=>{};`);await run('recompute(cur.ar)');
 check('missing departure is identified in the error message',()=>assert.equal(run(`cur.ar.kmState==='err'&&cur.ar.kmError.includes('Départ non localisé')&&cur.ar.kmError.includes('Bureau Blue Chili')`),true));
 run('ensureCoords=savedEnsure;');
 run(`cur=fixture();routeKm=async()=>{throw Error('failed')};`);await run('recompute(cur.ar)');
 check('routing failure clears stale automatic distance',()=>assert.equal(run('cur.ar.km'),''));
 ctx.fetch=async()=>({ok:true,json:async()=>({routes:[{distance:400}]})});
 const km=await run('osmKm({lat:33,lon:-7},{lat:33.1,lon:-7.1})');
 check('short route retains sub-kilometre distance',()=>assert.equal(km,0.4));
 run(`cur=fixture('2026-10-10','2026-10-13');cur.objet=('Coordination de la production de cet événement. ').repeat(65);`);
 for(const kind of ['om','ndf','detail']){const bytes=run(`BUILDERS['${kind}'][0](cur,P).output('arraybuffer')`);fs.mkdirSync(__dirname+'/../.sites-runtime/test-pdfs',{recursive:true});fs.writeFileSync(__dirname+'/../.sites-runtime/test-pdfs/'+kind+'.pdf',Buffer.from(bytes));check('PDF '+kind+' generates',()=>assert.ok(bytes.byteLength>1000));}
 run(`cur=fixture();cur.transport='Train';cur.ar.montant=130;cur.ar.montantRetour=150;cur.trajets=[{id:'ride',date:cur.depart,transport:'InDrive',dep:{label:'Gare Marrakech'},arr:{label:'Hôtel'},montant:60},{id:'car',date:cur.depart,transport:'Voiture',dep:{label:'Hôtel'},arr:{label:'Événement'},km:10,peage:5}];`);
 for(const kind of ['ndf','detail']){const bytes=run(`BUILDERS['${kind}'][0](cur,P).output('arraybuffer')`);fs.writeFileSync(__dirname+'/../.sites-runtime/test-pdfs/mixed-'+kind+'.pdf',Buffer.from(bytes));check('mixed transport PDF '+kind+' generates',()=>assert.ok(bytes.byteLength>1000));}
 run(`cur=fixture();cur.transport='Sans transport';cur.autres=[{intitule:'Parking',montant:25}];`);
 for(const kind of ['ndf','detail']){const bytes=run(`BUILDERS['${kind}'][0](cur,P).output('arraybuffer')`);fs.writeFileSync(__dirname+'/../.sites-runtime/test-pdfs/none-'+kind+'.pdf',Buffer.from(bytes));check('no transport PDF '+kind+' generates',()=>assert.ok(bytes.byteLength>1000));}
 run(`cur=fixture('2026-10-19','2026-10-21');cur.transport='Sans transport';cur.repasMode='journalier';cur.repasParJour={'2026-10-19':{petitDejeuner:true,dejeuner:true},'2026-10-20':{diner:true}};cur.avance=50;`);
 const repasPdf=run(`buildNDF(cur,P).output('arraybuffer')`);fs.writeFileSync(__dirname+'/../.sites-runtime/test-pdfs/repas-ndf.pdf',Buffer.from(repasPdf));
 check('daily meal PDF includes all three subtotals and the daily breakdown',()=>{const pdf=run(`buildNDF(cur,P).output()`);assert.ok(pdf.includes('Petit-déjeuner')&&pdf.includes('jeuner')&&pdf.includes('TOTAL REPAS')&&pdf.includes('19/10/2026')&&pdf.includes('250,00'))});
 run(`cur.retour='2027-02-28';cur.objet='Mission longue';`);fs.writeFileSync(__dirname+'/../.sites-runtime/test-pdfs/repas-long-ndf.pdf',Buffer.from(run(`buildNDF(cur,P).output('arraybuffer')`)));
 for(const pid of ['samir','wijdane']){
  run(`P=DB.profiles.find(p=>p.id==='${pid}');cur=fixture('2026-10-19','2026-10-21');cur.profileId=P.id;cur.objet='Coordination et production du projet';cur.numero=nextNumero();`);
  for(const kind of ['om','ndf','detail']){const doc=run(`BUILDERS['${kind}'][0](cur,P)`);const data=Buffer.from(doc.output('arraybuffer'));fs.writeFileSync(__dirname+'/../.sites-runtime/test-pdfs/'+pid+'-'+kind+'.pdf',data);check(pid+' '+kind+' PDF has the correct company footer',()=>assert.ok(doc.output().includes(pid==='samir'?'003379948000071':'003688600000028')));}
  run(`cur.objet=('Coordination de la production du projet. ').repeat(130);`);
  const longDoc=run(`buildOM(cur,P)`);fs.writeFileSync(__dirname+'/../.sites-runtime/test-pdfs/'+pid+'-long-om.pdf',Buffer.from(longDoc.output('arraybuffer')));
  check(pid+' letterhead repeats on every page of long documents',()=>assert.equal(longDoc._letterheadPages.size,longDoc.getNumberOfPages()));
 }
 run(`P=DB.profiles.find(p=>p.id==='karima');cur=null;`);
 const profiles=JSON.parse(run('JSON.stringify(defaultProfiles())'));
 const baseMission=JSON.parse(run('JSON.stringify(fixture())'));
 const server=new Map(profiles.map(profile=>[profile.id,{profile:{...profile,updated:'2026-10-14T18:00:00Z'},missions:[],recups:[],counters:{},deleted:{}}]));
 server.get('amine').missions=[{...baseMission,id:'amine-saved',profileId:'amine',objet:'Historique Amine'}];
 server.get('reda').missions=[{...baseMission,id:'reda-saved',profileId:'reda',objet:'Historique Reda'}];
 const legacy={profiles,missions:[{...baseMission,id:'local-before-password',profileId:'karima',objet:'Ancien historique local'}],recups:[],counters:{},deleted:{}};
 run(`localStorage.clear();localStorage.setItem(LEGACY_KEY,${JSON.stringify(JSON.stringify(legacy))});P=null;cur=null;emptyBrowserData();`);
 let actor={profileId:'reda',admin:false};
 ctx.fetch=async(url,init={})=>({ok:true,json:async()=>{
   if(url==='/api/auth/status')return {passwordRequired:true,passwordConfigured:true,required:false,accounts:[...server.values()].map(s=>({id:s.profile.id,nom:s.profile.nom,poste:s.profile.poste,civ:s.profile.civ})),...actor};
   if(url==='/api/bootstrap')return {profiles:[...(actor.admin?server.values():[server.get(actor.profileId)])].map(state=>({state,revision:1}))};
   if(url==='/api/admin/accounts'){
     if(init.method==='POST'){const data=JSON.parse(init.body);const id='cp-12345678-1234-4123-8123-123456789abc';const state={profile:{...profiles[0],...data,id,email:'',updated:new Date().toISOString()},missions:[],recups:[],conges:[],caisses:[],caisseEntries:[],counters:{},deleted:{}};server.set(id,state);return {account:{...data,id,admin:false},state,password:'TESTA-TESTB-TESTC-TESTD'};}
     return {accounts:[...server.values()].map(s=>({id:s.profile.id,nom:s.profile.nom,poste:s.profile.poste,civ:s.profile.civ,admin:s.profile.id==='karima'}))};
   }
   if(url==='/api/auth/password'){const body=JSON.parse(init.body);if(body.password==='wrong')throw Error('Mot de passe incorrect.');actor={profileId:body.profileId,admin:body.profileId==='karima'};return {verified:true,...actor};}
   if(url==='/api/auth/logout')return {loggedOut:true};
   if(url.startsWith('/api/profiles/')){const state=JSON.parse(init.body);server.set(state.profile.id,state);return {state,revision:2};}
   throw Error(url);
 }});
 await run('Cloud.init()');await run('Cloud.flush()');
 check('fresh password login restores only the personal server history',()=>assert.equal(run(`DB.missions.length===1&&DB.missions[0].id==='reda-saved'&&!DB.missions.some(m=>m.profileId==='karima')`),true));
 run(`openSession(DB.profiles.find(p=>p.id==='reda'));renderProfileMenu();`);
 check('Reda session hides the paid leave navigation',()=>assert.equal(node('#conges-nav').hidden,true));
 check('personal session menu cannot select another profile',()=>{assert.equal(node('#profile-select').disabled,true);assert.ok(node('#profile-select').innerHTML.includes('Reda'));assert.ok(!node('#profile-select').innerHTML.includes('Karima'))});
 await run('Cloud.signOut()');run('P=null;cur=null;');actor={profileId:'amine',admin:false};
 await run('Cloud.init()');run(`openSession(DB.profiles.find(p=>p.id==='amine'));renderProfileMenu();`);
 check('Amine receives only his personal history and cannot select another profile',()=>assert.equal(run(`P.id==='amine'&&DB.missions.length===1&&DB.missions[0].id==='amine-saved'&&$('#profile-select').disabled&&!$('#profile-select').innerHTML.includes('Karima')&&$('#conges-nav').hidden&&congesSummary(stateFor('amine'))===null`),true));
 await run('Cloud.signOut()');run('P=null;cur=null;');actor={profileId:'karima',admin:true};
 await run('Cloud.init()');await run('Cloud.flush()');
 check('administrator startup uploads old local history to the server',()=>assert.ok(server.get('karima').missions.some(m=>m.id==='local-before-password')));
 run(`openSession(DB.profiles.find(p=>p.id==='karima'));renderProfileMenu();`);
 check('eligible session displays the paid leave navigation',()=>assert.equal(node('#conges-nav').hidden,false));
 run(`renderConges();saveConge({date:'2026-10-12',jours:'0,5',note:'Congé personnel'});`);await run('Cloud.flush()');
 check('leave entries are stored on the server and included in personal backup',()=>{assert.equal(server.get('karima').conges[0].jours,0.5);assert.equal(run(`profileBackup('karima').conges.length`),1);assert.equal(run(`profileBackup('samir').conges.length`),0)});
 run(`const savedLeaveId=DB.conges[0].id;const oldLeaveSnapshot=JSON.parse(JSON.stringify(stateFor('karima')));deleteConge(savedLeaveId);applyRemote(oldLeaveSnapshot);`);await run('Cloud.flush()');
 check('deleted leave cannot reappear from a stale device snapshot',()=>assert.equal(run(`DB.conges.some(r=>r.id===savedLeaveId)`),false));
 check('old backups preserve current leave entries during import',()=>assert.equal(run(`(()=>{const entry={id:'import-keep',profileId:'karima',date:'2026-10-12',jours:0.5,updated:'2026-10-14T16:00:00Z'};DB.conges=[entry];importBackup({profiles:[P],missions:[],recups:[],counters:{}});const ok=DB.conges.some(r=>r.id===entry.id);DB.conges=[];return ok})()`),true));
 check('administrator menu includes all five profiles',()=>{assert.equal(node('#profile-select').disabled,false);assert.ok(['Karima','Wijdane','Samir','Reda','Amine'].every(x=>node('#profile-select').innerHTML.includes(x)))});
 run(`const fixtureCash=saveCaisseRecord({nom:'Caisse Casablanca',projet:'Convention',ville:'Casablanca',date:'2026-10-19',type:'projet'});caisseView().id=fixtureCash.id;saveCaisseEntry({caisseId:fixtureCash.id,type:'entree',date:'2026-10-19',libelle:'Avance',fournisseur:'Direction',montant:'1 000,00'});saveCaisseEntry({caisseId:fixtureCash.id,type:'depense',date:'2026-10-19',libelle:'Fourniture papier',fournisseur:'Papeterie',categorie:'fourniture',montant:'123,45'});saveCaisseEntry({caisseId:fixtureCash.id,type:'restitution',date:'2026-10-19',libelle:'Restitution',montant:'100'});`);
 await run('Cloud.flush()');
 check('standalone project cashbox and centime movements persist to the server',()=>{const s=server.get('karima');assert.equal(s.caisses.length,1);assert.equal(s.caisses[0].type,'projet');assert.equal(s.caisses[0].missionId,'');assert.equal(s.caisseEntries.length,3);assert.equal(run(`caisseStatement(stateFor(P.id),fixtureCash.id).soldeCts`),77655)});
 check('cashbox backup is private and old backup imports preserve its records',()=>assert.equal(run(`(()=>{importBackup({profiles:[P],missions:[],recups:[]});return profileBackup('karima').caisseEntries.length===3&&profileBackup('samir').caisseEntries.length===0})()`),true));
 check('cashbox UI renders categories and escaped project names',()=>{run(`fixtureCash.nom='<img src=x onerror=alert(1)>';renderCaisse();fixtureCash.nom='Caisse Casablanca';`);const view=node('#view').innerHTML;assert.ok(view.includes('&lt;img'));assert.ok(!view.includes('<img src=x'));assert.ok(view.includes('Main d’œuvre'));assert.ok(view.includes('Solde disponible'))});
 check('CSV exports protect formula-like user text and preserve centimes',()=>assert.equal(run(`(()=>{const text=buildCaisseCSV({...fixtureCash,nom:'=SUM(A1)'},stateFor(P.id));return text.includes("'=SUM(A1)")&&text.includes('"123,45"')})()`),true));
 const cashPdf=await run(`buildCaissePDF(fixtureCash,P,stateFor(P.id)).arrayBuffer()`);fs.writeFileSync(__dirname+'/../.sites-runtime/test-pdfs/caisse.pdf',Buffer.from(cashPdf));
 check('cash statement PDF generates with summary and journal',()=>assert.ok(cashPdf.byteLength>4000));
 fs.writeFileSync(__dirname+'/../.sites-runtime/test-pdfs/synthetic-receipt.pdf',Buffer.from(run(`(()=>{const doc=newDoc();doc.setFontSize(14);doc.text(['PAPETERIE DU CENTRE','Date : 18/10/2026','Papier A4 : 100,00','Stylos : 20,00','TOTAL HT : 120,00','TVA : 24,00','TOTAL TTC : 144,00 DH'],20,30);return doc.output('arraybuffer')})()`)));
 run(`const pendingCash=caisseDraft(fixtureCash.id);pendingCash.text='Pourboire 20 DH\\nCourse InDrive 30,50 DH';pendingCash.mode='liste';`);
 await run('recognizeCaisse(fixtureCash)');
 check('recognition prepares an editable table without booking any expense',()=>assert.equal(run(`pendingCash.rows.length===2&&DB.caisseEntries.length===3&&pendingCash.rows[0].categorie==='pourboire'&&pendingCash.rows[1].montant==='30,50'`),true));
 await run('commitCaisseRecognition(fixtureCash)');
 check('explicit confirmation books each selected row once',()=>{assert.equal(server.get('karima').caisseEntries.length,5);assert.equal(run(`caisseStatement(stateFor(P.id),fixtureCash.id).depensesCts`),17395)});
 run(`const repeatedCash=caisseDraft(fixtureCash.id);repeatedCash.text='Pourboire 20 DH\\nCourse InDrive 30,50 DH';repeatedCash.mode='liste';`);await run('recognizeCaisse(fixtureCash)');
 check('re-imported expenses are flagged and unchecked as possible duplicates',()=>assert.equal(run(`repeatedCash.rows.every(r=>r.duplicate&&!r.selected)`),true));
 check('deleting an expense survives a stale device snapshot',()=>assert.equal(run(`(()=>{const previous=JSON.parse(JSON.stringify(stateFor(P.id))),id=DB.caisseEntries.find(e=>e.source==='texte').id;deleteCaisseEntry(id);applyRemote(previous);return !DB.caisseEntries.some(e=>e.id===id)})()`),true));
 check('closed cashbox refuses entry changes',()=>assert.throws(()=>run(`fixtureCash.statut='cloturee';saveCaisseEntry({caisseId:fixtureCash.id,type:'depense',date:'2026-10-19',libelle:'Interdit',categorie:'autre',montant:'1'});`)));
 run(`fixtureCash.statut='ouverte';`);
 run(`const textCash=saveCaisseRecord({nom:'Saisie texte',projet:'Projet test',ville:'Casablanca',date:'2026-10-19',type:'projet'});caisseView().id=textCash.id;caisseView().recognition=true;const freeDraft=caisseDraft(textCash.id);freeDraft.text='Hier, j’ai payé 250 DH de fournitures chez Bricoma, 40 DH pour une course InDrive et 20 DH de pourboire. Aujourd’hui, 600 DH pour la main d’œuvre à Ahmed.';const beforeTextCount=DB.caisseEntries.length;recognizeCaisseText(textCash);`);
 check('free-text input proposes editable rows without saving expenses',()=>assert.equal(run(`freeDraft.rows.length===4&&DB.caisseEntries.length===beforeTextCount&&freeDraft.rows[0].fournisseur==='Bricoma'&&freeDraft.rows[3].fournisseur==='Ahmed'&&freeDraft.engine==='local'`),true));
 check('text-to-table controls are visible and retain the text across refreshes',()=>{run('renderCaisse();');assert.ok(node('#view').innerHTML.includes('Transformer le texte en tableau'));assert.ok(node('#view').innerHTML.includes('Écrire mes dépenses'));assert.ok(node('#view').innerHTML.includes('Analyse locale'));assert.ok(node('#view').innerHTML.includes('chez Bricoma'))});
 run(`freeDraft.rows[0].montant='255,50';freeDraft.rows[2].selected=false;`);await run('commitCaisseRecognition(textCash)');
 check('reviewed text rows save edited amounts and only selected expenses',()=>assert.equal(run(`(()=>{const s=caisseStatement(stateFor(P.id),textCash.id);return s.count===3&&s.depensesCts===89550&&s.journal.every(e=>e.type==='depense')})()`),true));
 run(`const receiptDraft=caisseDraft(textCash.id);receiptDraft.input='justificatifs';receiptDraft.ticketText='Papeterie du Centre\\n18/10/2026\\nTOTAL TTC 50 DH';receiptDraft.mode='ticket';receiptDraft.text='Taxi 100 DH';`);await run('recognizeCaisse(textCash)');
 check('receipt and free-text sources stay separate when switching inputs',()=>assert.equal(run(`receiptDraft.rows.length===1&&receiptDraft.rows[0].montant==='50,00'&&receiptDraft.text==='Taxi 100 DH'`),true));
 run(`histQ='old search';histMonth='2025-01';histProj='old project';openSession(DB.profiles.find(p=>p.id==='reda'));`);
 check('changing profile resets filters that could hide its history',()=>assert.equal(run(`histQ===''&&histMonth===''&&histProj===''`),true));
 run(`cur=newMission('2026-10-10');cur.retour='2026-10-13';cur.destination='Marrakech';cur.objet='Coordination du projet';cur.numero=nextNumero();`);
 fs.writeFileSync(__dirname+'/../.sites-runtime/test-pdfs/reda-om.pdf',Buffer.from(run(`buildOM(cur,P).output('arraybuffer')`)));
 await run('Cloud.flush()');await run('Cloud.signOut()');
 check('logout clears account records and the temporary cache',()=>assert.equal(run(`DB.missions.length===0&&DB.conges.length===0&&DB.caisses.length===0&&DB.caisseEntries.length===0&&Object.keys(caisseDrafts).length===0&&!Cloud.admin&&localStorage.getItem(KEY)===null`),true));
 actor={profileId:'karima',admin:true};run('P=null;cur=null;');await run('Cloud.init()');run(`openSession(DB.profiles.find(p=>p.id==='karima'));`);
 check('a fresh device session retrieves its cashbox and saved expenses from the server',()=>assert.equal(run(`DB.caisses.some(c=>c.id===fixtureCash.id)&&DB.caisseEntries.filter(e=>e.caisseId===fixtureCash.id).length===4`),true));
 await run('Cloud.signOut()');
 actor={profileId:'karima',admin:true};run('P=null;cur=null;');await run('Cloud.init()');run("openSession(DB.profiles.find(p=>p.id==='karima'));currentView='admin';");await run('renderAdmin()');
 check('only the administrator sees the administration navigation',()=>{assert.equal(node('#admin-nav').hidden,false);assert.ok(node('#view').innerHTML.includes('Créer une session'));assert.ok(node('#admin-team').innerHTML.includes('Administratrice'))});
 run("$('#admin-name').value='Nouvelle Cheffe';$('#admin-position').value='Cheffe de projet';$('#admin-civ').value='Mme';");await run("$('#admin-create').onsubmit({preventDefault(){}})");
 const newPid='cp-12345678-1234-4123-8123-123456789abc';
 check('creating a session updates the team, the selector and the one-time password dialog',()=>{assert.ok(node('#admin-team').innerHTML.includes('Nouvelle Cheffe'));assert.ok(node('#profile-select').innerHTML.includes('Nouvelle Cheffe'));assert.ok(node('#dlg-body').innerHTML.includes('TESTA-TESTB-TESTC-TESTD'));assert.equal(node('#admin-submit').disabled,false);assert.equal(node('#admin-name').value,'')});
 check('the generated password is excluded from browser data and personal backups',()=>assert.equal(run("!JSON.stringify(DB).includes('TESTA-TESTB-TESTC-TESTD')&&!localStorage.getItem(KEY).includes('TESTA-TESTB-TESTC-TESTD')"),true));
 run("P=DB.profiles.find(p=>p.nom==='Nouvelle Cheffe');cur=newMission('2026-10-19');cur.numero=nextNumero();cur.objet='Mission nouvelle session';changed();");await run('Cloud.flush()');
 check('new sessions have unique usable mission numbering and save their own history',()=>{assert.match(run('cur.numero'),/^OM-CP12345678-2026-/);assert.equal(server.get(newPid).missions.length,1);assert.equal(server.get(newPid).missions[0].profileId,newPid)});
 await run('Cloud.signOut()');run('P=null;cur=null;');actor={profileId:newPid,admin:false};await run('Cloud.init()');run("openSession(DB.profiles.find(p=>p.nom==='Nouvelle Cheffe'));");
 check('a newly created chef retrieves her history on a fresh login',()=>assert.equal(run("P.nom==='Nouvelle Cheffe'&&DB.missions.length===1&&DB.missions[0].objet==='Mission nouvelle session'&&$('#admin-nav').hidden&&$('#profile-select').disabled"),true));
 run("currentView='admin'");await run('renderAdmin()');
 check('personal accounts cannot render the create-account form',()=>{assert.ok(node('#view').innerHTML.includes('Accès réservé'));assert.ok(!node('#view').innerHTML.includes('admin-create'))});
 await run('Cloud.signOut()');run('P=null;cur=null;');actor={profileId:null,admin:false};await run('Cloud.init()');
 check('new sessions appear at the starting account choice without leaking history',()=>assert.equal(run("$('#sessions').innerHTML.includes('Nouvelle Cheffe')&&DB.missions.length===0&&DB.caisses.length===0"),true));
 run('Mobile.init();mobileViewport.matches=true;Mobile.setMenu(true);');
 check('phone menu opens as an accessible dialog and closes without changing the selected session',()=>{assert.equal(run("Mobile.menuOpen&&$('#main-sidebar').inert===false"),true);run('Mobile.setMenu(false)');assert.equal(run("!Mobile.menuOpen&&$('#main-sidebar').inert===true"),true)});
 check('mobile session dropdown includes accounts created by the administrator',()=>assert.ok(node('#mobile-profile').innerHTML.includes('Nouvelle Cheffe')));
 run("$('#mobile-profile').value='samir';$('#mobile-password').value='wrong';");await run('Mobile.submitLogin({preventDefault(){}})');
 check('wrong mobile password displays an error and allows another attempt',()=>{assert.ok(node('#mobile-login-message').textContent.includes('incorrect'));assert.equal(node('#mobile-login-submit').disabled,false);assert.equal(run('Cloud.authProfile'),null)});
 run("$('#mobile-password').value='Valid-Test-Samir';");await run('Mobile.submitLogin({preventDefault(){}})');
 check('mobile password login opens only the selected personal session and clears the password',()=>assert.equal(run("P.id==='samir'&&!Cloud.admin&&DB.missions.every(m=>m.profileId==='samir')&&$('#mobile-password').value===''"),true));
 run("P=DB.profiles.find(p=>p.id==='samir');cur=newMission('2026-10-19');cur.transport='Sans transport';cur.objet='Mobile capture';cur.repasParJour={'2026-10-19':{diner:true}};Mobile.update('edit');refreshSummary();");
 check('phone reimbursement bar uses actual meals, advances and payments',()=>{assert.equal(node('#mobile-total-amount').textContent,'100,00 DH');run('cur.avance=150;refreshSummary()');assert.equal(node('#mobile-total-label').textContent,'Avance à restituer');assert.equal(node('#mobile-total-amount').textContent,'50,00 DH')});
 run("Mobile.setMenu(true);go('hist');");
 check('navigating from the phone menu preserves the current mission and closes the drawer',()=>assert.equal(run("!Mobile.menuOpen&&currentView==='hist'&&DB.missions.some(m=>m.objet==='Mobile capture')"),true));
 run("cur=newMission('2026-10-19');cur.transport='Sans transport';const savedAttachMobile=attachAC;attachAC=()=>{};renderEditorMobileAudit();attachAC=savedAttachMobile;");
 check('editor includes direct step links, summary access and large meal labels',()=>{const view=node('#view').innerHTML;assert.ok(view.includes('id="step-mission"')&&view.includes('id="step-meals"')&&view.includes('id="mission-summary"'));assert.ok(node('#repas-ui').innerHTML.includes('repas-choice-label'));assert.ok(node('#repas-ui').innerHTML.includes('<label class="repas-choice">'))});
 const headers=['Date','Typologie','Libellé','Montant'];
 const fakeCells=[{dataset:{},colSpan:1},{dataset:{},colSpan:2},{dataset:{},colSpan:1}];
 const fakeTable={classList:{contains:()=>false,add(){}},closest(){return {classList:{add(){}}}},querySelectorAll(selector){return selector.startsWith('thead')?headers.map(textContent=>({textContent})):[{classList:{contains:()=>false},children:fakeCells}]}};
 const savedSelectAll=ctx.document.querySelectorAll;ctx.document.querySelectorAll=selector=>selector==='#view .tbl-wrap table'?[fakeTable]:[];
 run('Mobile.decorateTables()');ctx.document.querySelectorAll=savedSelectAll;
 check('stacked table cells retain the correct headings including column spans',()=>assert.deepEqual(fakeCells.map(c=>c.dataset.label),['Date','Typologie','Montant']));
 run("const mobileAgendaMonth=new Date(2026,9,1);const mobileAgendaMissions=[{id:'overlap',profileId:P.id,depart:'2026-09-29',retour:'2026-10-02',projet:'Projet inter-mois',objet:'Mission',destination:'Rabat'},{id:'other',profileId:'karima',depart:'2026-10-19',retour:'2026-10-19',projet:'Privé'}];");
 check('phone agenda includes missions spanning months and excludes another profile',()=>assert.equal(run("(()=>{const html=Mobile.agendaHTML(mobileAgendaMissions,mobileAgendaMonth);return html.includes('Projet inter-mois')&&!html.includes('Privé')})()"),true));
 run('mobileViewport.matches=false;Mobile.setMenu(false);');
 check('desktop navigation remains available when the screen expands',()=>assert.equal(node('#main-sidebar').inert,false));
 await run('Cloud.flush()');await run('Cloud.signOut()');
 console.log('UI tests passed:',passed);
})().catch(e=>{console.error(e);process.exitCode=1});
