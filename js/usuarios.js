function renderFormUsuario(c) {
  const v=f=>c?(c[f]??''):'';
  document.getElementById('content-body').innerHTML=`
    <div class="section-label"><span>Dados do Usuário</span></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" id="f-nome" value="${v('nome')}" placeholder="Nome completo"/></div>
      <div class="form-group"><label class="form-label">Username *</label><input class="form-input" id="f-username" value="${v('username')}" placeholder="Nome de usuário"/></div>
      <div class="form-group"><label class="form-label">${c?'Nova Senha (vazio = manter)':'Senha *'}</label><input class="form-input" type="password" id="f-senha" placeholder="${c?'Nova senha...':'Digite a senha'}"/></div>
      <div class="form-group"><label class="form-label">Confirmar Senha</label><input class="form-input" type="password" id="f-senha2" placeholder="Confirme a senha"/></div>
    </div>
    <div class="section-label"><span>Permissões</span></div>
    <div class="toggle-row">
      <div class="toggle-info"><strong>Administrador</strong><span>Permite acesso ao cadastro de usuários</span></div>
      <label class="toggle"><input type="checkbox" id="f-admin" ${c&&c.admin?'checked':''}/><span class="toggle-slider"></span></label>
    </div>
    <div class="toggle-row">
      <div class="toggle-info"><strong>Usuário Ativo</strong><span>Usuários inativos não conseguem fazer login</span></div>
      <label class="toggle"><input type="checkbox" id="f-ativo" ${(!c||c.ativo)?'checked':''}/><span class="toggle-slider"></span></label>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="saveUsuario()">${isNew?'+ Cadastrar':'✓ Salvar'}</button>
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;
}

async function saveUsuario() {
  const nome=document.getElementById('f-nome').value.trim();
  const username=document.getElementById('f-username').value.trim();
  const senha=document.getElementById('f-senha').value;
  const senha2=document.getElementById('f-senha2').value;
  const admin=document.getElementById('f-admin').checked;
  const ativo=document.getElementById('f-ativo').checked;
  if(!nome||!username){toast('Nome e username obrigatórios','error');return;}
  if(senha&&senha!==senha2){toast('Senhas não coincidem','error');return;}
  if(isNew&&!senha){toast('Senha obrigatória','error');return;}
  const btn=document.getElementById('btn-save'); btn.disabled=true; btn.textContent='Salvando...';
  try {
    if(isNew){
      const r=await fetch(`${SUPA_URL}/rest/v1/rpc/criar_usuario?apikey=${ANON_KEY}`,{method:'POST',headers:hdrs({'Content-Type':'application/json'}),body:JSON.stringify({p_nome:nome,p_username:username,p_senha:senha,p_ativo:ativo,p_admin:admin})});
      const res=await r.json();
      if(r.ok&&res?.ok!==false){
        toast('Usuário cadastrado!','success');
        await loadItems();
        if(res.id_usuario) openItem(res.id_usuario);
      } else {
        toast('Erro: '+(res?.message||'username já existe'),'error');
        btn.disabled=false; btn.textContent='+ Cadastrar Usuário';
      }
    } else {
      // Alterar senha se informada
      if(senha){
        await fetch(`${SUPA_URL}/rest/v1/rpc/alterar_senha?apikey=${ANON_KEY}`,{
          method:'POST',
          headers:hdrs({'Content-Type':'application/json'}),
          body:JSON.stringify({p_id:currentId,p_senha:senha})
        });
      }
      const{ok,data:res}=await apiPatch(`usuarios?id_usuario=eq.${currentId}`,{nome,username,admin,ativo});
      if(ok){
        toast('Usuário atualizado!','success');
        await loadItems();
        openItem(currentId);
      } else {
        toast('Erro: '+(res?.message||'erro'),'error');
        btn.disabled=false; btn.textContent='✓ Salvar Alterações';
      }
    }
  } catch(e){toast('Erro: '+e.message,'error');btn.disabled=false;btn.textContent=isNew?'+ Cadastrar':'✓ Salvar';}
}

// BUSCA CNPJ

async function deleteUsuario(id) {
  const c = items.find(x=>x.id_usuario===id);
  if(!c) return;
  if(c.admin){ toast('Não é possível excluir um administrador','error'); return; }
  if(!confirm(`Confirma exclusão do usuário "${c.nome}"?`)) return;
  const ok = await apiDelete(`usuarios?id_usuario=eq.${id}&apikey=${ANON_KEY}`);
  if(ok){ toast('Usuário excluído!','success'); await loadItems(); cancelForm(); }
  else toast('Erro ao excluir','error');
}
