/* Phone navigation and layout. Uses the same sessions, forms and server saves as desktop. */
const Mobile = (() => {
  const media=window.matchMedia?.('(max-width:900px)');
  let menuOpen=false, returnFocus=null, loginBusy=false;
  const isPhone=()=>!!media?.matches;
  const setMenu=(open,trigger)=>{
    menuOpen=!!open&&isPhone();
    const side=$('#main-sidebar');
    if(trigger)returnFocus=trigger;
    document.body.classList.toggle('mobile-menu-open',menuOpen);
    side.inert=isPhone()&&!menuOpen;
    if(menuOpen){side.setAttribute('role','dialog');side.setAttribute('aria-modal','true');}
    else{side.removeAttribute?.('role');side.removeAttribute?.('aria-modal');}
    $$('[data-mobile-menu]').forEach(b=>b.setAttribute('aria-expanded',String(menuOpen)));
    if(menuOpen)$('#mobile-menu-close').focus();
    else if(trigger===undefined&&returnFocus){returnFocus.focus();returnFocus=null;}
  };
  function syncLogin(){
    const select=$('#mobile-profile'), selected=select.value;
    const p=DB.profiles.find(p=>p.id===selected), canOpen=p&&Cloud.canOpen(p.id);
    $('#mobile-password-field').hidden=!!canOpen;
    $('#mobile-password').required=!canOpen;
    $('#mobile-login-submit').textContent=loginBusy?'Connexion…':canOpen?'Continuer':'Se connecter';
    $('#mobile-login-submit').disabled=loginBusy||!Cloud.ready;
  }
  function renderLogin(){
    const form=$('#mobile-login'), select=$('#mobile-profile');
    form.hidden=!Cloud.requiresPassword;
    $('#login').dataset.passwordLogin=String(Cloud.requiresPassword);
    const current=select.value||Cloud.authProfile||'';
    select.innerHTML='<option value="">Choisir ma session</option>'+DB.profiles.map(p=>`<option value="${esc(p.id)}" ${p.id===current?'selected':''}>${esc(sessionLabel(p.id))}${p.id==='karima'?' · Administration':''}</option>`).join('');
    select.value=DB.profiles.some(p=>p.id===current)?current:'';
    syncLogin();setMenu(false,null);
  }
  async function submitLogin(event){
    event.preventDefault();if(loginBusy)return;
    const p=DB.profiles.find(p=>p.id===$('#mobile-profile').value);
    if(!p){$('#mobile-login-message').textContent='Choisissez votre session.';return;}
    if(Cloud.canOpen(p.id)){openSession(p);return;}
    const field=$('#mobile-password');
    if(!field.value){$('#mobile-login-message').textContent='Saisissez votre mot de passe.';field.focus();return;}
    loginBusy=true;syncLogin();$('#mobile-login-message').textContent='Connexion à votre session…';
    try{
      const session=await Cloud.request('/api/auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profileId:p.id,password:field.value})});
      await Cloud.acceptPassword(session);field.value='';$('#mobile-login-message').textContent='';
    }catch(error){$('#mobile-login-message').textContent=error.message;}
    finally{loginBusy=false;syncLogin();}
  }
  function session(){
    document.body.classList.remove('mobile-typing');
    $('#mobile-user').textContent=P?sessionLabel(P.id):'';
    $('#mobile-scope').textContent=Cloud.admin?'Vue administratrice':'Mon espace personnel';
    $('#mobile-password').value='';$('#mobile-password').type='password';
    $('#mobile-password-toggle').textContent='Afficher';$('#mobile-password-toggle').setAttribute('aria-pressed','false');
  }
  function update(view=currentView){
    const wasOpen=menuOpen;
    document.body.dataset.view=view;
    const active=view==='edit'?'new':view;
    $$('#mobile-bottom [data-go]').forEach(b=>{const on=b.dataset.go===active;b.classList.toggle('on',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute?.('aria-current');});
    $('#mobile-more').classList.toggle('on',!['dash','hist','new','edit','caisse'].includes(view));
    setMenu(false,null);if(wasOpen)$('#view').focus({preventScroll:true});decorateTables();updateTotal();
  }
  function updateTotal(){
    if(!cur||!P||cur.profileId!==P.id)return;
    const s=settlement(cur);
    $('#mobile-total-label').textContent=s.giveBack?'Avance à restituer':'Reste à rembourser';
    $('#mobile-total-amount').textContent=moneyDH(s.giveBack||s.due);
  }
  function decorateTables(){
    $$('#view .tbl-wrap table').forEach(table=>{
      if(table.classList.contains('repas-table'))return;
      const headers=[...table.querySelectorAll('thead tr:first-child th')].map(th=>th.textContent.trim());
      if(!headers.length)return;
      table.classList.add('mobile-table');
      table.closest('.tbl-wrap')?.classList.add('mobile-table-wrap');
      table.querySelectorAll('tbody tr,tfoot tr').forEach(row=>{
        if(row.classList.contains('mhead'))return;
        let col=0;
        [...row.children].forEach(cell=>{cell.dataset.label=headers[col]||'Actions';col+=cell.colSpan||1;});
      });
    });
    $$('#view button[title]').forEach(button=>{if(!button.getAttribute('aria-label'))button.setAttribute('aria-label',button.getAttribute('title'));});
  }
  function agendaHTML(missions,month){
    const start=toISO(new Date(month.getFullYear(),month.getMonth(),1)), end=toISO(new Date(month.getFullYear(),month.getMonth()+1,0));
    const list=missions.filter(m=>m.profileId===P?.id&&m.depart<=end&&(m.retour||m.depart)>=start).sort((a,b)=>a.depart.localeCompare(b.depart));
    return `<section class="block mobile-only mobile-agenda"><header><h2>Les missions du mois</h2></header>${list.length?list.map(m=>`<button class="mobile-agenda-item" data-agenda-open="${esc(m.id)}"><span class="hint">${frDate(m.depart)}${m.retour!==m.depart?' → '+frDate(m.retour):''}</span><strong>${esc(m.projet||m.objet||'Déplacement')}</strong><span>${esc(m.destination||m.objet||m.numero)}</span></button>`).join(''):'<p class="hint">Aucune mission ce mois-ci. Touchez une date pour en créer une.</p>'}</section>`;
  }
  function init(){
    $('#mobile-login').onsubmit=submitLogin;
    $('#mobile-profile').onchange=()=>{$('#mobile-password').value='';$('#mobile-login-message').textContent='';syncLogin();};
    $('#mobile-password-toggle').onclick=()=>{const input=$('#mobile-password'),show=input.type==='password';input.type=show?'text':'password';$('#mobile-password-toggle').textContent=show?'Masquer':'Afficher';$('#mobile-password-toggle').setAttribute('aria-pressed',String(show));};
    $$('[data-mobile-menu]').forEach(button=>button.onclick=()=>setMenu(!menuOpen,button));
    $('#mobile-menu-close').onclick=()=>setMenu(false);
    $('#mobile-menu-backdrop').onclick=()=>setMenu(false);
    $('#mobile-bottom').onclick=event=>{const button=event.target.closest('[data-go]');if(button)go(button.dataset.go);};
    $('#mobile-summary-go').onclick=()=>{persistCurrent();$('#mission-summary')?.scrollIntoView?.({behavior:'smooth',block:'start'});};
    document.addEventListener('keydown',event=>{
      if(!menuOpen)return;
      if(event.key==='Escape'){event.preventDefault();setMenu(false);}
      if(event.key==='Tab'){
        const buttons=[...$('#main-sidebar').querySelectorAll('button:not([hidden]):not([disabled]),select,a[href]')].filter(el=>el.getClientRects().length);
        const first=buttons[0],last=buttons.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    });
    document.addEventListener('focusin',event=>{if(event.target.matches?.('input,textarea,select'))document.body.classList.add('mobile-typing');});
    document.addEventListener('focusout',()=>setTimeout(()=>{if(!document.activeElement?.matches?.('input,textarea,select'))document.body.classList.remove('mobile-typing');},0));
    media?.addEventListener?.('change',()=>setMenu(false,null));
    if(window.MutationObserver)new MutationObserver(()=>decorateTables()).observe($('#view'),{childList:true,subtree:true});
    setMenu(false,null);renderLogin();
  }
  return{init,session,renderLogin,submitLogin,update,updateTotal,decorateTables,agendaHTML,setMenu,get menuOpen(){return menuOpen;}};
})();
const refreshPhoneSummary=refreshSummary;
refreshSummary=function(){refreshPhoneSummary();Mobile.updateTotal();};
