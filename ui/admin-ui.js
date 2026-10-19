let adminAccounts = [];
async function renderAdmin() {
  if (!Cloud.admin) { $('#view').innerHTML='<section class="block"><h1>Accès réservé à l’administratrice</h1></section>'; return; }
  $('#view').innerHTML = `<div class="pagehead"><div><h1>Administration de l’équipe</h1><p>Créez une session pour chaque chef de projet. Vous conservez l’accès à tous les historiques.</p></div></div>
    <section class="block"><header><h2>Créer une session</h2></header>
      <form id="admin-create"><div class="grid">
        <div class="f"><label for="admin-civ">Civilité</label><select id="admin-civ" name="civ"><option>Mme</option><option>M.</option></select></div>
        <div class="f"><label for="admin-name">Nom et prénom</label><input id="admin-name" name="nom" required minlength="2" maxlength="100" autocomplete="off" placeholder="Nom du chef de projet"></div>
        <div class="f"><label for="admin-position">Poste</label><input id="admin-position" name="poste" required minlength="2" maxlength="100" value="Chef de projet" autocomplete="off"></div>
      </div><p class="hint">Le compte utilise l’en-tête Blue Chili. Ses informations et son logo peuvent être complétés dans ses paramètres.</p>
      <p class="hint" id="admin-message" role="status" aria-live="polite"></p><button class="btn primary" id="admin-submit" type="submit">Créer la session et son mot de passe</button></form>
    </section><section class="block"><header><h2>Sessions de l’équipe</h2></header><div id="admin-team" aria-live="polite">Chargement de l’équipe…</div></section>`;
  $('#admin-create').onsubmit = async event => {
    event.preventDefault(); if (!Cloud.admin) return;
    const button=$('#admin-submit'); button.disabled=true;
    const payload={nom:$('#admin-name').value.trim(),poste:$('#admin-position').value.trim(),civ:$('#admin-civ').value};
    $('#admin-message').textContent='Création sur le serveur…';
    try {
      const result=await Cloud.request('/api/admin/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      applyRemote(result.state); rememberAccount(result.account); renderProfileMenu();
      $('#admin-name').value=''; $('#admin-message').textContent='Session créée. Le compte apparaît dès maintenant à la connexion.';
      adminAccounts.push(result.account); renderAdminTeam();
      showCreatedAccount(result);
    } catch(error) { $('#admin-message').textContent=error.message; }
    finally { button.disabled=false; }
  };
  try { const r=await Cloud.request('/api/admin/accounts');adminAccounts=r.accounts;if(currentView==='admin')renderAdminTeam(); }
  catch(error) { if(currentView==='admin')$('#admin-team').textContent=error.message; }
}
function renderAdminTeam() {
  $('#admin-team').innerHTML=`<div class="tbl-wrap"><table><thead><tr><th>Nom</th><th>Poste</th><th>Accès</th><th>Historique</th></tr></thead><tbody>${adminAccounts.map(a=>`<tr><td>${esc(DB.profiles.find(p=>p.id===a.id)?.nom||a.nom)}</td><td>${esc(DB.profiles.find(p=>p.id===a.id)?.poste||a.poste)}</td><td><span class="pill ${a.admin?'ok':''}">${a.admin?'Administratrice':'Personnel'}</span></td><td><button class="btn small" data-admin-open="${esc(a.id)}">Ouvrir la session</button></td></tr>`).join('')}</tbody></table></div>`;
  $('#admin-team').onclick=e=>{const id=e.target.closest('[data-admin-open]')?.dataset.adminOpen;if(!id||!Cloud.admin)return;const p=DB.profiles.find(x=>x.id===id);if(p){cur=null;openSession(p);}else toast('Actualisez les données pour charger cette session.');};
}
function showCreatedAccount(result) {
  dialog(`<h3>Session créée · ${esc(result.account.nom)}</h3><p>Copiez ce mot de passe maintenant pour le communiquer à votre chef de projet. Il ne sera plus affiché après fermeture.</p>
    <div class="f"><label for="created-password">Mot de passe personnel</label><input id="created-password" type="text" readonly autocomplete="off" spellcheck="false" value="${esc(result.password)}"></div>
    <p class="hint">Accès : ${esc(location.origin || 'la plateforme Blue Chili')}<br>Session à choisir : ${esc(result.account.nom)}</p><p class="hint" id="copy-message" role="status"></p>
    <div class="row"><button class="btn" id="copy-created">Copier les accès</button><button class="btn primary" data-close>J’ai conservé le mot de passe</button></div>`);
  $('#copy-created').onclick=async()=>{try{await navigator.clipboard.writeText(`Plateforme : ${location.origin}\nSession : ${result.account.nom}\nMot de passe : ${result.password}`);$('#copy-message').textContent='Accès copiés.';}catch{$('#created-password').focus();$('#created-password').select();$('#copy-message').textContent='Sélectionnez puis copiez le mot de passe.';}};
  $('#dlg').addEventListener('close',()=>{$('#dlg-body').innerHTML='';},{once:true});
}
