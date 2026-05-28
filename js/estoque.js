function formatQtd(n) {
  return Number(n||0).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function formatDateTimeBR(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '';
}

async function getProdutoEstoque(idProduto) {
  const data = await apiGet(`produtos?select=id_produto,nome_mercadoria,estoque_atual&id_produto=eq.${idProduto}`);
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function renderFormEstoque(c) {
  await loadCaches();

  if(c) {
    const tipo = c.tipo_movimentacao === 'ENTRADA_AJUSTE' ? 'Entrada por ajuste' : 'Saida por ajuste';
    const sinal = c.tipo_movimentacao === 'ENTRADA_AJUSTE' ? '+' : '-';
    document.getElementById('content-body').innerHTML = `
      <div class="section-label"><span>Movimentacao de Estoque</span></div>
      <div class="form-grid">
        <div class="form-group full"><label class="form-label">Produto</label><input class="form-input" value="${c.produtos?.nome_mercadoria||'Produto #'+c.id_produto}" readonly/></div>
        <div class="form-group"><label class="form-label">Tipo</label><input class="form-input" value="${tipo}" readonly/></div>
        <div class="form-group"><label class="form-label">Origem</label><input class="form-input" value="${c.origem||'AJUSTE_MANUAL'}" readonly/></div>
        <div class="form-group"><label class="form-label">Quantidade</label><input class="form-input" value="${sinal}${formatQtd(c.quantidade)}" readonly/></div>
        <div class="form-group"><label class="form-label">Estoque anterior</label><input class="form-input" value="${formatQtd(c.estoque_anterior)}" readonly/></div>
        <div class="form-group"><label class="form-label">Estoque atual</label><input class="form-input" value="${formatQtd(c.estoque_atual)}" readonly/></div>
        <div class="form-group full"><label class="form-label">Data</label><input class="form-input" value="${formatDateTimeBR(c.data_movimentacao)}" readonly/></div>
      </div>
      <div class="section-label"><span>Observacoes</span></div>
      <div class="form-group"><textarea class="form-textarea" readonly>${c.observacoes||''}</textarea></div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="cancelForm()">Voltar</button>
      </div>`;
    return;
  }

  const prodOpts = cacheProdutos.map(p =>
    `<option value="${p.id_produto}" data-estoque="${Number(p.estoque_atual||0)}">${p.nome_mercadoria} - estoque ${formatQtd(p.estoque_atual)}</option>`
  ).join('');

  document.getElementById('content-body').innerHTML = `
    <div class="section-label"><span>Novo Ajuste Manual</span></div>
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Produto *</label>
        <select class="form-input form-select" id="f-id_produto" onchange="updateEstoquePreview()">
          <option value="">Selecione o produto...</option>
          ${prodOpts}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Tipo *</label>
        <select class="form-input form-select" id="f-tipo_movimentacao" onchange="updateEstoquePreview()">
          <option value="ENTRADA_AJUSTE">Entrada por ajuste</option>
          <option value="SAIDA_AJUSTE">Saida por ajuste</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Quantidade *</label>
        <input class="form-input" type="number" step="0.01" min="0.01" id="f-quantidade" value="1" oninput="updateEstoquePreview()"/>
      </div>
      <div class="form-group">
        <label class="form-label">Estoque atual</label>
        <input class="form-input" id="f-estoque_atual_preview" value="-" readonly/>
      </div>
      <div class="form-group">
        <label class="form-label">Novo estoque</label>
        <input class="form-input" id="f-novo_estoque_preview" value="-" readonly style="color:var(--accent);font-weight:600;"/>
      </div>
    </div>
    <div class="section-label"><span>Motivo do Ajuste</span></div>
    <div class="form-group"><textarea class="form-textarea" id="f-observacoes" placeholder="Ex: contagem fisica, avaria, perda, correcao de lancamento..."></textarea></div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="saveMovimentacaoEstoque()">Salvar Ajuste</button>
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;
}

function updateEstoquePreview() {
  const sel = document.getElementById('f-id_produto');
  const opt = sel?.options[sel.selectedIndex];
  const estoqueAtual = Number(opt?.dataset?.estoque || 0);
  const tipo = document.getElementById('f-tipo_movimentacao')?.value;
  const quantidade = Number(document.getElementById('f-quantidade')?.value || 0);
  const novoEstoque = tipo === 'SAIDA_AJUSTE' ? estoqueAtual - quantidade : estoqueAtual + quantidade;

  const atualEl = document.getElementById('f-estoque_atual_preview');
  const novoEl = document.getElementById('f-novo_estoque_preview');
  if(atualEl) atualEl.value = sel?.value ? formatQtd(estoqueAtual) : '-';
  if(novoEl) {
    novoEl.value = sel?.value ? formatQtd(novoEstoque) : '-';
    novoEl.style.color = novoEstoque < 0 ? 'var(--danger)' : 'var(--accent)';
  }
}

async function saveMovimentacaoEstoque() {
  const idProduto = document.getElementById('f-id_produto').value;
  const tipo = document.getElementById('f-tipo_movimentacao').value;
  const quantidade = Number(document.getElementById('f-quantidade').value || 0);
  const observacoes = document.getElementById('f-observacoes').value.trim() || null;

  if(!idProduto){ toast('Selecione o produto','error'); return; }
  if(quantidade <= 0){ toast('Quantidade deve ser maior que zero','error'); return; }

  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  const produto = await getProdutoEstoque(idProduto);
  if(!produto) {
    toast('Produto nao encontrado.','error');
    btn.disabled = false;
    btn.textContent = 'Salvar Ajuste';
    return;
  }

  const estoqueAnterior = Number(produto.estoque_atual || 0);
  const estoqueAtual = tipo === 'SAIDA_AJUSTE' ? estoqueAnterior - quantidade : estoqueAnterior + quantidade;
  const patchRes = await apiPatch(`produtos?id_produto=eq.${idProduto}`,{ estoque_atual: estoqueAtual });
  if(!patchRes.ok) {
    toast('Erro ao atualizar estoque: '+(patchRes.data?.message||'erro'),'error');
    btn.disabled = false;
    btn.textContent = 'Salvar Ajuste';
    return;
  }

  const movRes = await apiPost('estoque_movimentacoes',{
    id_produto: Number(idProduto),
    tipo_movimentacao: tipo,
    origem: 'AJUSTE_MANUAL',
    quantidade,
    estoque_anterior: estoqueAnterior,
    estoque_atual: estoqueAtual,
    observacoes,
    id_usuario: usuario?.id || usuario?.id_usuario || null
  });

  if(!movRes.ok) {
    await apiPatch(`produtos?id_produto=eq.${idProduto}`,{ estoque_atual: estoqueAnterior });
    toast('Erro ao registrar movimentacao. Estoque foi restaurado. '+(movRes.data?.message||''),'error');
    btn.disabled = false;
    btn.textContent = 'Salvar Ajuste';
    return;
  }

  toast('Ajuste de estoque registrado!','success');
  await loadCaches();
  await loadItems();
  const mov = Array.isArray(movRes.data) ? movRes.data[0] : movRes.data;
  if(mov?.id_movimentacao) openItem(mov.id_movimentacao);
}
