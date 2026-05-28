function renderFormCadastro(c) {
  const v=f=>c?(c[f]??''):'';
  document.getElementById('content-body').innerHTML=`
    <div class="section-label"><span>Identificação</span><button class="btn-search-cnpj" onclick="openCNPJModal('update')">🔍 Buscar CNPJ</button></div>
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Razão Social *</label><input class="form-input" id="f-razao_social" value="${v('razao_social')}" placeholder="Nome jurídico"/></div>
      <div class="form-group"><label class="form-label">Nome Fantasia</label><input class="form-input" id="f-nome_fantasia" value="${v('nome_fantasia')}" placeholder="Nome comercial"/></div>
      <div class="form-group"><label class="form-label">CPF / CNPJ</label><input class="form-input" id="f-cpf_cnpj" value="${v('cpf_cnpj')}" placeholder="00.000.000/0001-00"/></div>
    </div>
    <div class="section-label"><span>Contato</span></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Telefone</label><input class="form-input" id="f-telefone" value="${v('telefone')}" placeholder="(41) 99999-9999"/></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="f-email" value="${v('email')}" placeholder="contato@empresa.com"/></div>
    </div>
    <div class="section-label"><span>Endereço</span></div>
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Logradouro</label><input class="form-input" id="f-endereco" value="${v('endereco')}" placeholder="Rua, Avenida..."/></div>
      <div class="form-group" style="max-width:110px"><label class="form-label">Número</label><input class="form-input" id="f-numero" value="${v('numero')}" placeholder="123"/></div>
      <div class="form-group"><label class="form-label">Bairro</label><input class="form-input" id="f-bairro" value="${v('bairro')}" placeholder="Bairro"/></div>
      <div class="form-group"><label class="form-label">Cidade</label><input class="form-input" id="f-cidade" value="${v('cidade')}" placeholder="Cidade"/></div>
      <div class="form-group" style="max-width:80px"><label class="form-label">UF</label><input class="form-input" id="f-estado" value="${v('estado')}" placeholder="PR" maxlength="2"/></div>
      <div class="form-group"><label class="form-label">CEP</label><input class="form-input" id="f-cep" value="${v('cep')}" placeholder="00000-000"/></div>
    </div>
    <div class="section-label"><span>Observações</span></div>
    <div class="form-group"><textarea class="form-textarea" id="f-observacoes" placeholder="Informações adicionais...">${v('observacoes')}</textarea></div>
    <div class="section-label"><span>Status</span></div>
    <div class="toggle-row">
      <div class="toggle-info"><strong>Ativo</strong><span>Registros inativos ficam ocultos</span></div>
      <label class="toggle"><input type="checkbox" id="f-ativo" ${(!c||c.ativo)?'checked':''}/><span class="toggle-slider"></span></label>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="saveCadastro()">${isNew?'+ Cadastrar':'✓ Salvar'}</button>
      ${!isNew?`<button class="btn btn-danger" onclick="toggleAtivo()">${c&&c.ativo?'✕ Desativar':'✓ Reativar'}</button>`:''}
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;
}

async function saveCadastro() {
  const cfg=tabConfig[currentTab];
  const razao=document.getElementById('f-razao_social').value.trim();
  if(!razao){ toast('Razão Social é obrigatória','error'); return; }
  const btn=document.getElementById('btn-save');
  btn.disabled=true; btn.textContent='Salvando...';
  const g=id=>document.getElementById(id)?.value.trim()||null;
  const data={razao_social:razao,nome_fantasia:g('f-nome_fantasia'),cpf_cnpj:g('f-cpf_cnpj'),telefone:g('f-telefone'),email:g('f-email'),endereco:g('f-endereco'),numero:g('f-numero'),bairro:g('f-bairro'),cidade:g('f-cidade'),estado:(g('f-estado')||'').toUpperCase()||null,cep:g('f-cep'),observacoes:g('f-observacoes'),ativo:document.getElementById('f-ativo').checked};
  if(isNew){
    const{ok,data:res}=await apiPost(cfg.table,data);
    if(ok){toast(cfg.label+' cadastrado!','success');await loadItems();const n=Array.isArray(res)?res[0]:res;if(n)openItem(n[cfg.id]);}
    else{toast('Erro: '+(res?.message||'erro'),'error');btn.disabled=false;btn.textContent='+ Cadastrar';}
  } else {
    const{ok,data:res}=await apiPatch(`${cfg.table}?${cfg.id}=eq.${currentId}`,data);
    if(ok){toast('Salvo!','success');await loadItems();openItem(currentId);}
    else{toast('Erro: '+(res?.message||'erro'),'error');btn.disabled=false;btn.textContent='✓ Salvar';}
  }
}

function fillForm(data) {
  ['razao_social','nome_fantasia','cpf_cnpj','telefone','email','endereco','numero','bairro','cidade','estado','cep','observacoes'].forEach(f=>{
    const el=document.getElementById('f-'+f); if(el&&data[f]) el.value=data[f];
  });
  toast('Dados preenchidos! Revise e salve.','info');
}

async function toggleAtivo() {
  const cfg=tabConfig[currentTab];
  const c=items.find(x=>x[cfg.id]===currentId);
  if(!c) return;
  const{ok}=await apiPatch(`${cfg.table}?${cfg.id}=eq.${currentId}`,{ativo:!c.ativo});
  if(ok){toast(c.ativo?'Desativado!':'Reativado!','success');await loadItems();openItem(currentId);}
  else toast('Erro','error');
}


function openCNPJModal(mode) {
  cnpjMode=mode; cnpjSelectedData=null;
  const pre=mode==='update'?(document.getElementById('f-cpf_cnpj')?.value||''):'';
  document.getElementById('cnpj-query').value=pre.trim();
  document.getElementById('cnpj-results').innerHTML='';
  document.getElementById('cnpj-footer').style.display='none';
  document.getElementById('cnpj-modal').style.display='flex';
  setTimeout(()=>document.getElementById('cnpj-query').focus(),100);
}
function closeCNPJModal(){ document.getElementById('cnpj-modal').style.display='none'; }

async function doCNPJSearch() {
  const q=document.getElementById('cnpj-query').value.trim();
  if(!q) return;
  const div=document.getElementById('cnpj-results');
  div.innerHTML='<div class="loading"><div class="spinner"></div> Buscando na Receita Federal...</div>';
  document.getElementById('cnpj-footer').style.display='none';
  try {
    const res=await fetch('/.netlify/functions/buscar-cliente',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});
    const parsed=await res.json();
    if(!parsed?.resultados?.length){
      div.innerHTML='<div style="padding:20px;text-align:center;color:var(--text2);">Nenhum resultado. Verifique o CNPJ.</div>';
      return;
    }
    cnpjSelectedData=parsed.resultados[0];
    div.innerHTML=parsed.resultados.map((r,i)=>`
      <div class="result-card ${parsed.resultados.length===1?'selected':''}" id="rc-${i}" onclick="selectCNPJ(${i})">
        <div class="result-card-name">${r.nome_fantasia||r.razao_social||'—'}</div>
        <div class="result-card-detail">
          ${r.razao_social&&r.nome_fantasia?`📋 <span>${r.razao_social}</span><br/>`:''}
          ${r.cpf_cnpj?`🪪 <span>${r.cpf_cnpj}</span><br/>`:''}
          ${r.telefone?`📞 <span>${r.telefone}</span><br/>`:''}
          ${r.cidade?`📍 <span>${[r.endereco,r.numero,r.bairro,r.cidade,r.estado].filter(Boolean).join(', ')}</span>`:''}
        </div>
      </div>`).join('');
    div.dataset.res=JSON.stringify(parsed.resultados);
    document.getElementById('cnpj-footer').style.display='flex';
  } catch(e){
    div.innerHTML=`<div style="padding:16px;color:var(--danger);font-size:13px;">Erro: ${e.message}</div>`;
  }
}

function selectCNPJ(i){
  const res=JSON.parse(document.getElementById('cnpj-results').dataset.res||'[]');
  document.querySelectorAll('.result-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('rc-'+i)?.classList.add('selected');
  cnpjSelectedData=res[i];
}

function useCNPJResult(){
  if(!cnpjSelectedData) return;
  closeCNPJModal();
  if(cnpjMode==='new'){openNew();setTimeout(()=>fillForm(cnpjSelectedData),50);}
  else fillForm(cnpjSelectedData);
}
