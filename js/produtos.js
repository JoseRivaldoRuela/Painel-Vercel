function renderFormTipo(c) {
  const v=f=>c?(c[f]??''):'';
  document.getElementById('content-body').innerHTML=`
    <div class="section-label"><span>Tipo de Mercadoria</span></div>
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Descrição *</label><input class="form-input" id="f-descricao" value="${v('descricao')}" placeholder="Ex: Massas, Frios, Bebidas..."/></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="saveTipo()">${isNew?'+ Cadastrar':'✓ Salvar'}</button>
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;
}

async function saveTipo() {
  const desc=document.getElementById('f-descricao').value.trim();
  if(!desc){toast('Descrição obrigatória','error');return;}
  const btn=document.getElementById('btn-save'); btn.disabled=true; btn.textContent='Salvando...';
  if(isNew){
    const{ok,data:res}=await apiPost('tipo_mercadoria',{descricao:desc});
    if(ok){toast('Tipo cadastrado!','success');await loadItems();await loadCaches();const n=Array.isArray(res)?res[0]:res;if(n)openItem(n.id_tipo);}
    else{toast('Erro: '+(res?.message||'erro'),'error');btn.disabled=false;btn.textContent='+ Cadastrar';}
  } else {
    const{ok}=await apiPatch(`tipo_mercadoria?id_tipo=eq.${currentId}`,{descricao:desc});
    if(ok){toast('Salvo!','success');await loadItems();await loadCaches();openItem(currentId);}
    else{toast('Erro','error');btn.disabled=false;btn.textContent='✓ Salvar';}
  }
}

// CACHES
async function loadCaches() {
  const[t,f,p,c]=await Promise.all([
    apiGet('tipo_mercadoria?select=id_tipo,descricao&order=descricao.asc'),
    apiGet('fornecedores?select=id_fornecedor,nome_fantasia,razao_social&ativo=eq.true&order=razao_social.asc'),
    apiGet('produtos?select=id_produto,nome_mercadoria,preco_venda,preco_custo,estoque_atual&ativo=eq.true&order=nome_mercadoria.asc'),
    apiGet('clientes?select=id_cliente,nome_fantasia,razao_social&ativo=eq.true&order=razao_social.asc')
  ]);
  if(Array.isArray(t)) cacheTipos=t;
  if(Array.isArray(f)) cacheFornecedores=f;
  if(Array.isArray(p)) cacheProdutos=p;
  if(Array.isArray(c)) cacheClientes=c;
}

function buildSelect(id,opts,vf,lf,sel,ph='Selecione...'){
  const o=opts.map(x=>`<option value="${x[vf]}" ${String(x[vf])===String(sel)?'selected':''}>${x[lf]||x.razao_social||x.nome_fantasia||x.descricao}</option>`).join('');
  return `<select class="form-input form-select" id="${id}"><option value="">${ph}</option>${o}</select>`;
}

// FORM PRODUTO
async function renderFormProduto(c) {
  await loadCaches();
  const v=f=>c?(c[f]??''):'';
  const unids=['UN','KG','LT','CX','PC','DZ','MT','M2','GL'];
  document.getElementById('content-body').innerHTML=`
    <div class="section-label"><span>Dados do Produto</span></div>
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Nome do Produto *</label><input class="form-input" id="f-nome_mercadoria" value="${v('nome_mercadoria')}" placeholder="Nome do produto"/></div>
      <div class="form-group"><label class="form-label">Tipo de Mercadoria *</label>${buildSelect('f-id_tipo',cacheTipos,'id_tipo','descricao',v('id_tipo'),'Selecione o tipo...')}</div>
      <div class="form-group"><label class="form-label">Fornecedor</label>${buildSelect('f-id_fornecedor',cacheFornecedores,'id_fornecedor','nome_fantasia',v('id_fornecedor'),'Nenhum')}</div>
      <div class="form-group"><label class="form-label">Unidade</label><select class="form-input form-select" id="f-unidade"><option value="">Selecione...</option>${unids.map(u=>`<option value="${u}" ${v('unidade')===u?'selected':''}>${u}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Estoque Atual</label><input class="form-input" type="number" step="0.01" id="f-estoque_atual" value="${v('estoque_atual')}" placeholder="0"/></div>
    </div>
    <div class="section-label"><span>Preços</span></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Preço de Custo (R$) *</label><input class="form-input" type="number" step="0.01" id="f-preco_custo" value="${v('preco_custo')}" placeholder="0,00" oninput="calcMargem()"/></div>
      <div class="form-group"><label class="form-label">Preço de Venda (R$) *</label><input class="form-input" type="number" step="0.01" id="f-preco_venda" value="${v('preco_venda')}" placeholder="0,00" oninput="calcMargem()"/></div>
      <div class="form-group full"><div class="margem-info" id="margem-info"></div></div>
    </div>
    <div class="section-label"><span>Observações</span></div>
    <div class="form-group"><textarea class="form-textarea" id="f-observacoes" placeholder="Informações adicionais...">${v('observacoes')}</textarea></div>
    <div class="section-label"><span>Status</span></div>
    <div class="toggle-row">
      <div class="toggle-info"><strong>Produto Ativo</strong><span>Produtos inativos não aparecem nas listagens</span></div>
      <label class="toggle"><input type="checkbox" id="f-ativo" ${(!c||c.ativo)?'checked':''}/><span class="toggle-slider"></span></label>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="saveProduto()">${isNew?'+ Cadastrar':'✓ Salvar'}</button>
      ${!isNew?`<button class="btn btn-danger" onclick="toggleAtivo()">${c&&c.ativo?'✕ Desativar':'✓ Reativar'}</button>`:''}
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;
  calcMargem();
}

function calcMargem() {
  const custo=parseFloat(document.getElementById('f-preco_custo')?.value||0);
  const venda=parseFloat(document.getElementById('f-preco_venda')?.value||0);
  const el=document.getElementById('margem-info'); if(!el) return;
  if(custo>0&&venda>0){
    const m=((venda-custo)/custo*100).toFixed(1);
    const l=(venda-custo).toFixed(2);
    const cor=m>0?'var(--accent)':'var(--danger)';
    el.innerHTML=`Margem: <strong style="color:${cor}">${m}%</strong> &nbsp;·&nbsp; Lucro unitário: <strong style="color:${cor}">R$ ${l}</strong>`;
  } else el.innerHTML='';
}

async function saveProduto() {
  const nome=document.getElementById('f-nome_mercadoria').value.trim();
  const id_tipo=document.getElementById('f-id_tipo').value;
  const custo=document.getElementById('f-preco_custo').value;
  const venda=document.getElementById('f-preco_venda').value;
  if(!nome){toast('Nome obrigatório','error');return;}
  if(!id_tipo){toast('Selecione o tipo','error');return;}
  if(!custo||!venda){toast('Preços obrigatórios','error');return;}
  const btn=document.getElementById('btn-save'); btn.disabled=true; btn.textContent='Salvando...';
  const data={nome_mercadoria:nome,id_tipo:parseInt(id_tipo),id_fornecedor:document.getElementById('f-id_fornecedor').value?parseInt(document.getElementById('f-id_fornecedor').value):null,unidade:document.getElementById('f-unidade').value||null,estoque_atual:parseFloat(document.getElementById('f-estoque_atual').value)||0,preco_custo:parseFloat(custo),preco_venda:parseFloat(venda),observacoes:document.getElementById('f-observacoes').value.trim()||null,ativo:document.getElementById('f-ativo').checked};
  if(isNew){
    const{ok,data:res}=await apiPost('produtos',data);
    if(ok){toast('Produto cadastrado!','success');await loadItems();await loadCaches();const n=Array.isArray(res)?res[0]:res;if(n)openItem(n.id_produto);}
    else{toast('Erro: '+(res?.message||'erro'),'error');btn.disabled=false;btn.textContent='+ Cadastrar';}
  } else {
    const{ok}=await apiPatch(`produtos?id_produto=eq.${currentId}`,data);
    if(ok){toast('Salvo!','success');await loadItems();openItem(currentId);}
    else{toast('Erro','error');btn.disabled=false;btn.textContent='✓ Salvar';}
  }
}

// FORM PREÇO ESPECIAL
async function renderFormPreco(c) {
  await loadCaches();
  const v=f=>c?(c[f]??''):'';
  const prodSel=buildSelect('f-id_produto',cacheProdutos,'id_produto','nome_mercadoria',v('id_produto'),'Selecione o produto...');
  const cliSel=buildSelect('f-id_cliente',cacheClientes,'id_cliente','nome_fantasia',v('id_cliente'),'Selecione o cliente...');
  let precoRef='';
  if(c?.id_produto){const p=cacheProdutos.find(x=>x.id_produto===c.id_produto);if(p)precoRef=`Preço padrão: R$ ${Number(p.preco_venda||0).toFixed(2)}`;}
  document.getElementById('content-body').innerHTML=`
    <div class="section-label"><span>Preço Especial por Cliente</span></div>
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Cliente *</label>${cliSel}</div>
      <div class="form-group full"><label class="form-label">Produto *</label>${prodSel}</div>
      <div class="form-group"><label class="form-label">Preço Especial (R$) *</label><input class="form-input" type="number" step="0.01" id="f-preco_especial" value="${v('preco_especial')}" placeholder="0,00"/></div>
      <div class="form-group" style="justify-content:flex-end"><div style="font-size:12px;color:var(--text2);padding-top:28px" id="preco-ref">${precoRef}</div></div>
    </div>
    <div class="section-label"><span>Observações</span></div>
    <div class="form-group"><textarea class="form-textarea" id="f-observacoes" placeholder="Motivo do preço especial...">${v('observacoes')}</textarea></div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="savePreco()">${isNew?'+ Cadastrar':'✓ Salvar'}</button>
      ${!isNew?`<button class="btn btn-danger" onclick="deletePreco()">🗑 Excluir</button>`:''}
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;
  document.getElementById('f-id_produto')?.addEventListener('change',async function(){
    const p=cacheProdutos.find(x=>String(x.id_produto)===this.value);
    document.getElementById('preco-ref').textContent=p?`Preço padrão: R$ ${Number(p.preco_venda||0).toFixed(2)}`:'';
  });
}

async function savePreco() {
  const id_cli=document.getElementById('f-id_cliente').value;
  const id_prod=document.getElementById('f-id_produto').value;
  const preco=document.getElementById('f-preco_especial').value;
  if(!id_cli){toast('Selecione o cliente','error');return;}
  if(!id_prod){toast('Selecione o produto','error');return;}
  if(!preco){toast('Informe o preço','error');return;}
  const btn=document.getElementById('btn-save'); btn.disabled=true; btn.textContent='Salvando...';
  const data={id_cliente:parseInt(id_cli),id_produto:parseInt(id_prod),preco_especial:parseFloat(preco),observacoes:document.getElementById('f-observacoes').value.trim()||null};
  if(isNew){
    const{ok,data:res}=await apiPost('produtos_precos_especiais',data);
    if(ok){toast('Preço especial cadastrado!','success');await loadItems();const n=Array.isArray(res)?res[0]:res;if(n)openItem(n.id_preco_especial);}
    else{toast('Erro: '+(res?.message||'erro'),'error');btn.disabled=false;btn.textContent='+ Cadastrar';}
  } else {
    const{ok}=await apiPatch(`produtos_precos_especiais?id_preco_especial=eq.${currentId}`,data);
    if(ok){toast('Salvo!','success');await loadItems();openItem(currentId);}
    else{toast('Erro','error');btn.disabled=false;btn.textContent='✓ Salvar';}
  }
}

async function deletePreco() {
  if(!confirm('Confirma exclusão?')) return;
  const ok=await apiDelete(`produtos_precos_especiais?id_preco_especial=eq.${currentId}`);
  if(ok){toast('Excluído!','success');await loadItems();cancelForm();}
  else toast('Erro ao excluir','error');
}
