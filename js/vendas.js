
async function renderDashboard() {
  const body = document.getElementById('content-body');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando dashboard...</div>';

  // Buscar dados
  const hoje = new Date();
  const inicioHoje = hoje.toISOString().slice(0,10);
  const inicioSemana = new Date(hoje - 7*24*60*60*1000).toISOString().slice(0,10);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10);

  const [todasVendas, itensTodos] = await Promise.all([
    apiGet('vendas?select=id_venda,codigo_venda,data_venda,valor_final,status_entrega,id_cliente,clientes(nome_fantasia,razao_social)&order=data_venda.desc'),
    apiGet('venda_itens?select=id_venda,id_produto,quantidade,subtotal,produtos!fk_item_produto(nome_mercadoria)')
  ]);

  if(!Array.isArray(todasVendas)) { body.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div><p>Erro ao carregar dados</p></div>'; return; }

  const itens = Array.isArray(itensTodos) ? itensTodos : [];

  // Calcular totais
  const vendasHoje = todasVendas.filter(v => v.data_venda?.slice(0,10) === inicioHoje);
  const vendasSemana = todasVendas.filter(v => v.data_venda?.slice(0,10) >= inicioSemana);
  const vendasMes = todasVendas.filter(v => v.data_venda?.slice(0,10) >= inicioMes);
  const pendentes = todasVendas.filter(v => v.status_entrega !== 'ENTREGUE' && v.status_entrega !== 'CANCELADO');

  const soma = arr => arr.reduce((s,v) => s + Number(v.valor_final||0), 0);
  const fmt = n => 'R$ ' + Number(n).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});

  // Top clientes
  const clienteMap = {};
  todasVendas.forEach(v => {
    const nome = v.clientes?.nome_fantasia || v.clientes?.razao_social || `Cliente #${v.id_cliente}`;
    if(!clienteMap[nome]) clienteMap[nome] = {nome, total:0, qtd:0, id:v.id_cliente};
    clienteMap[nome].total += Number(v.valor_final||0);
    clienteMap[nome].qtd++;
  });
  const topClientes = Object.values(clienteMap).sort((a,b)=>b.total-a.total).slice(0,5);

  // Top produtos
  const prodMap = {};
  itens.forEach(i => {
    const nome = i.produtos?.nome_mercadoria || `Produto #${i.id_produto}`;
    if(!prodMap[nome]) prodMap[nome] = {nome, total:0, qtd:0, id:i.id_produto};
    prodMap[nome].total += Number(i.subtotal||0);
    prodMap[nome].qtd += Number(i.quantidade||0);
  });
  const topProdutos = Object.values(prodMap).sort((a,b)=>b.total-a.total).slice(0,5);

  // Dados para gráfico de linha (últimos N dias)
  const dias = parseInt(dashPeriodo);
  const labels = [], valores = [];
  for(let i=dias-1; i>=0; i--) {
    const d = new Date(hoje - i*24*60*60*1000);
    const ds = d.toISOString().slice(0,10);
    labels.push(d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
    const total = todasVendas.filter(v=>v.data_venda?.slice(0,10)===ds).reduce((s,v)=>s+Number(v.valor_final||0),0);
    valores.push(total);
  }

  // Renderizar HTML
  body.innerHTML = `
    <!-- Cards de totais -->
    <div class="dash-grid">
      <div class="dash-card green" onclick="filtrarVendasDash('hoje')">
        <div class="dash-card-label">Vendas Hoje</div>
        <div class="dash-card-value">${fmt(soma(vendasHoje))}</div>
        <div class="dash-card-sub">${vendasHoje.length} pedido${vendasHoje.length!==1?'s':''}</div>
      </div>
      <div class="dash-card blue" onclick="filtrarVendasDash('semana')">
        <div class="dash-card-label">Últimos 7 Dias</div>
        <div class="dash-card-value">${fmt(soma(vendasSemana))}</div>
        <div class="dash-card-sub">${vendasSemana.length} pedido${vendasSemana.length!==1?'s':''}</div>
      </div>
      <div class="dash-card orange" onclick="filtrarVendasDash('mes')">
        <div class="dash-card-label">Este Mês</div>
        <div class="dash-card-value">${fmt(soma(vendasMes))}</div>
        <div class="dash-card-sub">${vendasMes.length} pedido${vendasMes.length!==1?'s':''}</div>
      </div>
      <div class="dash-card red" onclick="filtrarVendasDash('pendente')">
        <div class="dash-card-label">Entregas Pendentes</div>
        <div class="dash-card-value">${pendentes.length}</div>
        <div class="dash-card-sub">${fmt(soma(pendentes))}</div>
      </div>
    </div>

    <!-- Gráfico de vendas + Top Clientes -->
    <div class="dash-charts">
      <div class="dash-chart-box">
        <div class="dash-chart-title">
          <span>📈 Vendas por Período</span>
          <div class="dash-chart-period">
            <button class="dash-period-btn ${dashPeriodo==='7'?'active':''}" onclick="mudarPeriodo('7')">7d</button>
            <button class="dash-period-btn ${dashPeriodo==='15'?'active':''}" onclick="mudarPeriodo('15')">15d</button>
            <button class="dash-period-btn ${dashPeriodo==='30'?'active':''}" onclick="mudarPeriodo('30')">30d</button>
          </div>
        </div>
        <div class="dash-canvas-wrap"><canvas id="chart-vendas"></canvas></div>
      </div>

      <div class="dash-chart-box">
        <div class="dash-chart-title"><span>🏆 Melhores Clientes</span></div>
        <div class="dash-list" id="dash-clientes">
          ${topClientes.length === 0 ? '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Nenhum dado</div>' :
          topClientes.map((c,i) => {
            const pct = topClientes[0].total > 0 ? (c.total/topClientes[0].total*100).toFixed(0) : 0;
            return `<div class="dash-list-item" onclick="filtrarClienteDash(${c.id},'${c.nome.replace(/'/g,"\'")}')">
              <span class="dash-list-rank">${i+1}</span>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span class="dash-list-name">${c.nome}</span>
                  <span class="dash-list-value">${fmt(c.total)}</span>
                </div>
                <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${pct}%"></div></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Top Produtos -->
    <div class="dash-chart-box" style="margin-bottom:20px;">
      <div class="dash-chart-title"><span>📦 Melhores Produtos</span></div>
      <div class="dash-two-col" id="dash-produtos">
        ${topProdutos.length === 0 ? '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;grid-column:1/-1;">Nenhum dado</div>' :
        topProdutos.map((p,i) => {
          const pct = topProdutos[0].total > 0 ? (p.total/topProdutos[0].total*100).toFixed(0) : 0;
          return `<div class="dash-list-item" onclick="filtrarProdutoDash(${p.id},'${p.nome.replace(/'/g,"\'")}')">
            <span class="dash-list-rank">${i+1}</span>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span class="dash-list-name">${p.nome}</span>
                <span class="dash-list-value">${fmt(p.total)}</span>
              </div>
              <div style="font-size:11px;color:var(--text2);">${p.qtd.toFixed(1)} un vendidas</div>
              <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${pct}%;background:var(--accent2)"></div></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  // Renderizar gráfico
  setTimeout(() => {
    const ctx = document.getElementById('chart-vendas');
    if(!ctx) return;
    if(chartVendas) chartVendas.destroy();
    chartVendas = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Vendas (R$)',
          data: valores,
          borderColor: '#00e5a0',
          backgroundColor: 'rgba(0,229,160,0.08)',
          borderWidth: 2,
          pointBackgroundColor: '#00e5a0',
          pointRadius: 4,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => 'R$ ' + Number(ctx.raw).toLocaleString('pt-BR',{minimumFractionDigits:2})
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8888a0', font: { size: 11 } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8888a0', font: { size: 11 }, callback: v => 'R$ '+Number(v).toLocaleString('pt-BR') } }
        }
      }
    });
  }, 100);
}

async function mudarPeriodo(p) {
  dashPeriodo = p;
  await renderDashboard();
}

function filtrarVendasDash(filtro) {
  const hoje = new Date().toISOString().slice(0,10);
  const semana = new Date(Date.now()-7*24*60*60*1000).toISOString().slice(0,10);
  const mes = new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10);
  let vendFiltradas = [...items];
  let titulo = '';
  if(filtro==='hoje'){ vendFiltradas=items.filter(v=>v.data_venda?.slice(0,10)===hoje); titulo='Vendas de Hoje'; }
  else if(filtro==='semana'){ vendFiltradas=items.filter(v=>v.data_venda?.slice(0,10)>=semana); titulo='Vendas — Últimos 7 Dias'; }
  else if(filtro==='mes'){ vendFiltradas=items.filter(v=>v.data_venda?.slice(0,10)>=mes); titulo='Vendas — Este Mês'; }
  else if(filtro==='pendente'){ vendFiltradas=items.filter(v=>v.status_entrega!=='ENTREGUE' && v.status_entrega!=='CANCELADO'); titulo='Entregas Pendentes'; }
  mostrarDetalheVendas(vendFiltradas, titulo);
}

function filtrarClienteDash(idCliente, nome) {
  const filtradas = items.filter(v=>v.id_cliente===idCliente);
  mostrarDetalheVendas(filtradas, 'Vendas — '+nome);
}

function filtrarProdutoDash(idProduto, nome) {
  // Mostrar vendas que contém esse produto
  mostrarDetalheVendas(items, 'Produto: '+nome);
}

function mostrarDetalheVendas(vendas, titulo) {
  const fmt = n => 'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const total = vendas.reduce((s,v)=>s+Number(v.valor_final||0),0);
  document.getElementById('content-body').innerHTML = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <button onclick="renderDashboard()" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:12px;padding:5px 12px;cursor:pointer;">← Voltar</button>
      <span style="font-size:15px;font-weight:600;">${titulo}</span>
      <span style="font-size:12px;color:var(--text2);margin-left:auto;">${vendas.length} venda${vendas.length!==1?'s':''} · ${fmt(total)}</span>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Pedido</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Cliente</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Data</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Status</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Valor</th>
        </tr></thead>
        <tbody>
          ${vendas.length === 0 ? '<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text3);">Nenhuma venda encontrada</td></tr>' :
          vendas.map(v=>`<tr style="border-top:1px solid var(--border);cursor:pointer;" onclick="openItem(${v.id_venda})" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
            <td style="padding:10px 14px;font-weight:500;color:var(--accent);font-family:var(--mono);">${v.codigo_venda||'#'+v.id_venda}</td>
            <td style="padding:10px 14px;color:var(--text);">${v.clientes?.nome_fantasia||v.clientes?.razao_social||'-'}</td>
            <td style="padding:10px 14px;text-align:center;color:var(--text2);">${v.data_venda?new Date(v.data_venda).toLocaleDateString('pt-BR'):'-'}</td>
            <td style="padding:10px 14px;text-align:center;">
              <span class="pill ${v.status_entrega==='ENTREGUE'?'on':v.status_entrega==='CANCELADO'?'off':'warn'}">${v.status_entrega==='ENTREGUE'?'Entregue':v.status_entrega==='CANCELADO'?'Cancelado':'Pendente'}</span>
            </td>
            <td style="padding:10px 14px;text-align:right;font-weight:600;color:var(--accent);font-family:var(--mono);">${fmt(v.valor_final||0)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr style="border-top:2px solid var(--border);background:var(--surface2);">
          <td colspan="4" style="padding:10px 14px;font-weight:600;font-size:13px;">Total</td>
          <td style="padding:10px 14px;text-align:right;font-weight:700;color:var(--accent);font-family:var(--mono);">${fmt(total)}</td>
        </tr></tfoot>
      </table>
    </div>`;
}

// =====================
// VENDAS
// =====================

async function loadCacheCobrancas() {
  const r = await apiGet('tipo_cobranca?select=id_cobranca,descricao&order=descricao.asc');
  if(Array.isArray(r)) cacheCobrancas = r;
}

async function renderFormVenda(c) {
  await loadCaches();
  await loadCacheCobrancas();
  itensVenda = [];

  // Carregar itens existentes se for edição
  if(c) {
    const itens = await apiGet(`venda_itens?select=*,produtos!fk_item_produto(nome_mercadoria,id_produto,preco_custo)&id_venda=eq.${c.id_venda}`);
    if(Array.isArray(itens)) {
      itensVenda = itens.map(i => ({
        id_item: i.id_item,
        id_produto: i.id_produto,
        nome_produto: i.produtos?.nome_mercadoria || '',
        quantidade: Number(i.quantidade),
        preco_unitario: Number(i.preco_unitario),
        desconto_item: Number(i.desconto_item||0),
        subtotal: Number(i.subtotal),
        preco_custo: Number(i.produtos?.preco_custo||0)
      }));
    }
  }

  const v = f => c ? (c[f]??'') : '';

  // Gerar próximo código automaticamente para nova venda
  let proximoCodigo = '';
  if(isNew) {
    const ultimas = await apiGet('vendas?select=codigo_venda&order=id_venda.desc&limit=1');
    if(Array.isArray(ultimas) && ultimas.length > 0) {
      const ultimo = ultimas[0].codigo_venda || 'PED-0000';
      const num = parseInt(ultimo.replace(/[^0-9]/g,'')) || 0;
      proximoCodigo = 'PED-' + String(num+1).padStart(4,'0');
    } else {
      proximoCodigo = 'PED-0001';
    }
  }

  const statusMap = {'PENDENTE':'Pendente','ENTREGUE':'Entregue'};
  const statusOpts = Object.entries(statusMap).map(([val,label]) =>
    `<option value="${val}" ${v('status_entrega')===val?'selected':''}>${label}</option>`).join('');
  const pagOpts = cacheCobrancas.map(t =>
    `<option value="${t.descricao}" ${v('meio_pagamento')===t.descricao?'selected':''}>${t.descricao}</option>`).join('');
  const cliOpts = cacheClientes.map(cl =>
    `<option value="${cl.id_cliente}" ${String(v('id_cliente'))===String(cl.id_cliente)?'selected':''}>${cl.nome_fantasia||cl.razao_social}</option>`).join('');
  const entregaActions = isNew ? '' : c?.status_entrega === 'ENTREGUE'
    ? `<span class="pill on" style="padding:8px 14px;font-size:12px;">✅ Entregue</span><button class="btn btn-danger" onclick="cancelarEntrega(${c.id_venda})">Cancelar Entrega</button>`
    : `<button class="btn btn-primary" style="background:var(--accent2);" onclick="marcarEntregue(${c.id_venda})">✅ Marcar Entregue</button>`;

  document.getElementById('content-body').innerHTML = `
    <div class="section-label"><span>Dados da Venda</span></div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Código da Venda *</label>
        <input class="form-input" id="f-codigo_venda" value="${isNew ? proximoCodigo : v('codigo_venda')}" placeholder="PED-0001" ${isNew?'readonly':''}/>
      </div>
      <div class="form-group">
        <label class="form-label">Data da Venda *</label>
        <input class="form-input" type="datetime-local" id="f-data_venda" value="${v('data_venda')?v('data_venda').slice(0,16):new Date().toISOString().slice(0,16)}"/>
      </div>
      <div class="form-group full">
        <label class="form-label">Cliente *</label>
        <select class="form-input form-select" id="f-id_cliente">
          <option value="">Selecione o cliente...</option>
          ${cliOpts}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-input form-select" id="f-status_entrega">
          ${statusOpts}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Data de Entrega</label>
        <input class="form-input" type="datetime-local" id="f-data_entrega" value="${v('data_entrega')?v('data_entrega').slice(0,16):''}"/>
      </div>
    </div>

    <div class="section-label"><span>Pagamento</span></div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Meio de Pagamento</label>
        <select class="form-input form-select" id="f-meio_pagamento">
          <option value="">Selecione...</option>
          ${pagOpts}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Vencimento</label>
        <input class="form-input" type="date" id="f-data_vencimento" value="${v('data_vencimento')}"/>
      </div>
      <div class="form-group">
        <label class="form-label">Desconto Total (R$)</label>
        <input class="form-input" type="number" step="0.01" id="f-desconto_total" value="${v('desconto_total')||'0'}" oninput="calcTotais()"/>
      </div>
    </div>

    <div class="section-label"><span>Observações</span></div>
    <div class="form-group">
      <textarea class="form-textarea" id="f-observacoes" placeholder="Observações do pedido...">${v('observacoes')}</textarea>
    </div>

    <div class="section-label">
      <span>Itens do Pedido</span>
    </div>

    <!-- Adicionar item -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:12px;">
      <div class="form-grid" style="margin-bottom:10px;">
        <div class="form-group full">
          <label class="form-label">Produto</label>
          <select class="form-input form-select" id="item-produto" onchange="preencherPreco()">
            <option value="">Selecione o produto...</option>
            ${cacheProdutos.map(p=>`<option value="${p.id_produto}" data-preco="${p.preco_venda}">${p.nome_mercadoria} — R$ ${Number(p.preco_venda||0).toFixed(2)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Quantidade</label>
          <input class="form-input" type="number" step="1" id="item-qty" value="1" min="1" oninput="calcItemSubtotal()"/>
        </div>
        <div class="form-group">
          <label class="form-label">Preço Unitário (R$)</label>
          <input class="form-input" type="number" step="0.01" id="item-preco" value="" placeholder="0,00" oninput="calcItemSubtotal()"/>
        </div>
        <div class="form-group">
          <label class="form-label">Desconto Item (R$)</label>
          <input class="form-input" type="number" step="0.01" id="item-desconto" value="0" oninput="calcItemSubtotal()"/>
        </div>
        <div class="form-group">
          <label class="form-label">Subtotal</label>
          <input class="form-input" id="item-subtotal" value="R$ 0,00" readonly style="color:var(--accent);font-weight:600;"/>
        </div>
      </div>
      <button class="btn btn-primary" style="width:100%;" onclick="adicionarItem()">+ Adicionar Item</button>
    </div>

    <!-- Lista de itens -->
    <div id="lista-itens" style="margin-bottom:16px;"></div>

    <!-- Totais -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;color:var(--text2);">
        <span>Subtotal produtos:</span><span id="total-produtos">R$ 0,00</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;color:var(--text2);">
        <span>Desconto total:</span><span id="total-desconto" style="color:var(--danger);">- R$ 0,00</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:600;border-top:1px solid var(--border);padding-top:10px;margin-top:4px;">
        <span>Valor Final:</span><span id="total-final" style="color:var(--accent);">R$ 0,00</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px;color:var(--text2);border-top:1px dashed var(--border);padding-top:8px;">
        <span>💰 Custo Total:</span><span id="total-custo" style="color:var(--text2);">R$ 0,00</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:14px;font-weight:700;">
        <span>📈 Lucro Líquido:</span><span id="total-lucro" style="color:var(--success,#22c55e);">R$ 0,00</span>
      </div>
    </div>

    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="saveVenda()">${isNew?'+ Registrar Venda':'✓ Salvar Alterações'}</button>
      ${entregaActions}
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;

  renderItens();
  calcTotais();
}

function preencherPreco() {
  const sel = document.getElementById('item-produto');
  const opt = sel.options[sel.selectedIndex];
  const preco = opt?.dataset?.preco || '';
  document.getElementById('item-preco').value = preco ? Number(preco).toFixed(2) : '';
  calcItemSubtotal();

  // Verificar preço especial para o cliente
  const idCliente = document.getElementById('f-id_cliente')?.value;
  const idProduto = sel.value;
  if(idCliente && idProduto) {
    apiGet(`produtos_precos_especiais?select=preco_especial&id_cliente=eq.${idCliente}&id_produto=eq.${idProduto}`).then(r => {
      if(Array.isArray(r) && r.length > 0) {
        document.getElementById('item-preco').value = Number(r[0].preco_especial).toFixed(2);
        calcItemSubtotal();
        toast('Preço especial aplicado para este cliente!','info');
      }
    });
  }
}

function calcItemSubtotal() {
  const qty = parseInt(document.getElementById('item-qty')?.value||0);
  const preco = parseFloat(document.getElementById('item-preco')?.value||0);
  const desc = parseFloat(document.getElementById('item-desconto')?.value||0);
  const sub = (qty * preco) - desc;
  const el = document.getElementById('item-subtotal');
  if(el) el.value = 'R$ ' + Math.max(0,sub).toFixed(2);
}

function adicionarItem() {
  const sel = document.getElementById('item-produto');
  const idProd = sel.value;
  const nomeProd = sel.options[sel.selectedIndex]?.text?.split(' — ')[0] || '';
  const qty = parseInt(document.getElementById('item-qty').value||0);
  const preco = parseFloat(document.getElementById('item-preco').value||0);
  const desc = parseFloat(document.getElementById('item-desconto').value||0);

  if(!idProd){ toast('Selecione um produto','error'); return; }
  if(qty<=0){ toast('Quantidade deve ser maior que zero','error'); return; }
  if(preco<=0){ toast('Preço deve ser maior que zero','error'); return; }

  const subtotal = Math.max(0,(qty*preco)-desc);
  const prodCache = cacheProdutos.find(p=>String(p.id_produto)===String(idProd));
  const precoCusto = prodCache ? Number(prodCache.preco_custo||0) : 0;
  itensVenda.push({ id_produto:parseInt(idProd), nome_produto:nomeProd, quantidade:qty, preco_unitario:preco, desconto_item:desc, subtotal, preco_custo:precoCusto });

  // Limpar campos
  document.getElementById('item-produto').value='';
  document.getElementById('item-qty').value='1';
  document.getElementById('item-preco').value='';
  document.getElementById('item-desconto').value='0';
  document.getElementById('item-subtotal').value='R$ 0,00';

  renderItens();
  calcTotais();
}

function removerItem(idx) {
  itensVenda.splice(idx,1);
  renderItens();
  calcTotais();
}

function renderItens() {
  const div = document.getElementById('lista-itens');
  if(!itensVenda.length){ div.innerHTML='<div style="padding:12px;text-align:center;color:var(--text3);font-size:13px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);">Nenhum item adicionado</div>'; return; }
  div.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:var(--surface2);">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Produto</th>
        <th style="padding:8px 12px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Qtd</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Custo Unit.</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Preço</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Desc</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Subtotal</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Lucro</th>
        <th style="padding:8px 12px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;"></th>
      </tr></thead>
      <tbody>
        ${itensVenda.map((item,i)=>{
          const custo = Number(item.preco_custo||0);
          const custoTotal = custo * Number(item.quantidade);
          const lucroItem = Number(item.subtotal) - custoTotal;
          const lucroColor = lucroItem >= 0 ? 'var(--success,#22c55e)' : 'var(--danger)';
          return `<tr style="border-top:1px solid var(--border);">
          <td style="padding:8px 12px;color:var(--text);">${item.nome_produto||item.produtos?.nome_mercadoria||'Produto'}</td>
          <td style="padding:8px 12px;text-align:center;color:var(--text);">${item.quantidade}</td>
          <td style="padding:8px 12px;text-align:right;color:var(--text2);font-size:12px;">${custo>0?'R$ '+custo.toFixed(2):'-'}</td>
          <td style="padding:8px 12px;text-align:right;color:var(--text);">R$ ${Number(item.preco_unitario).toFixed(2)}</td>
          <td style="padding:8px 12px;text-align:right;color:var(--danger);">${item.desconto_item>0?'- R$ '+Number(item.desconto_item).toFixed(2):'-'}</td>
          <td style="padding:8px 12px;text-align:right;color:var(--accent);font-weight:600;">R$ ${Number(item.subtotal).toFixed(2)}</td>
          <td style="padding:8px 12px;text-align:right;color:${lucroColor};font-weight:600;">${custo>0?(lucroItem>=0?'R$ ':'- R$ ')+Math.abs(lucroItem).toFixed(2):'-'}</td>
          <td style="padding:8px 12px;text-align:center;"><button onclick="removerItem(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;">✕</button></td>
        </tr>`;}).join('')}
      </tbody>
    </table>
  </div>`;
}

function calcTotais() {
  const totalProd = itensVenda.reduce((s,i)=>s+Number(i.subtotal),0);
  const totalCusto = itensVenda.reduce((s,i)=>s+(Number(i.preco_custo||0)*Number(i.quantidade)),0);
  const desconto = parseFloat(document.getElementById('f-desconto_total')?.value||0);
  const final = Math.max(0,totalProd-desconto);
  const lucro = final - totalCusto;
  const fmt = n=>'R$ '+n.toFixed(2);
  const elProd=document.getElementById('total-produtos'); if(elProd) elProd.textContent=fmt(totalProd);
  const elDesc=document.getElementById('total-desconto'); if(elDesc) elDesc.textContent='- '+fmt(desconto);
  const elFinal=document.getElementById('total-final'); if(elFinal) elFinal.textContent=fmt(final);
  const elCusto=document.getElementById('total-custo'); if(elCusto) elCusto.textContent=fmt(totalCusto);
  const elLucro=document.getElementById('total-lucro');
  if(elLucro){
    elLucro.textContent=fmt(lucro);
    elLucro.style.color = lucro>=0 ? 'var(--success,#22c55e)' : 'var(--danger)';
  }
}

function buildVendaItensPayload(vendaId, itens = itensVenda) {
  return itens.map(item => ({
    id_venda: vendaId,
    id_produto: Number(item.id_produto),
    quantidade: Number(item.quantidade),
    preco_unitario: Number(item.preco_unitario),
    desconto_item: Number(item.desconto_item||0)
  }));
}

async function insertVendaItens(vendaId, itens = itensVenda) {
  const payload = buildVendaItensPayload(vendaId, itens);
  if(!payload.length) return { ok:false, data:{ message:'Venda sem itens.' } };
  return apiPost('venda_itens', payload);
}

async function getItensEstoqueVenda(idVenda) {
  const itens = await apiGet(`venda_itens?select=id_produto,quantidade,produtos!fk_item_produto(id_produto,nome_mercadoria,estoque_atual)&id_venda=eq.${idVenda}`);
  if(!Array.isArray(itens)) return [];

  const porProduto = new Map();
  itens.forEach(item => {
    const idProduto = Number(item.id_produto);
    const atual = porProduto.get(idProduto) || {
      id_produto: idProduto,
      nome: item.produtos?.nome_mercadoria || `Produto #${idProduto}`,
      quantidade: 0,
      estoque_atual: Number(item.produtos?.estoque_atual || 0)
    };
    atual.quantidade += Number(item.quantidade || 0);
    porProduto.set(idProduto, atual);
  });

  return Array.from(porProduto.values());
}

async function ajustarEstoqueVenda(idVenda, operacao) {
  const itens = await getItensEstoqueVenda(idVenda);
  if(!itens.length) return { ok:false, message:'Nenhum item encontrado para ajustar estoque.' };

  for(const item of itens) {
    const novoEstoque = operacao === 'baixar'
      ? item.estoque_atual - item.quantidade
      : item.estoque_atual + item.quantidade;
    const res = await apiPatch(`produtos?id_produto=eq.${item.id_produto}`,{estoque_atual:novoEstoque});
    if(!res.ok) return { ok:false, message:res.data?.message || `Erro ao ajustar estoque de ${item.nome}.` };
  }

  return { ok:true };
}

async function saveVenda() {
  const codigo = document.getElementById('f-codigo_venda').value.trim();
  const id_cliente = document.getElementById('f-id_cliente').value;
  const data_venda = document.getElementById('f-data_venda').value;
  if(!codigo){ toast('Código da venda é obrigatório','error'); return; }
  if(!id_cliente){ toast('Selecione o cliente','error'); return; }
  if(!data_venda){ toast('Data da venda é obrigatória','error'); return; }
  if(itensVenda.length===0){ toast('Adicione pelo menos um item','error'); return; }

  const btn=document.getElementById('btn-save'); btn.disabled=true; btn.textContent='Salvando...';

  const totalProd = itensVenda.reduce((s,i)=>s+Number(i.subtotal),0);
  const totalCusto = itensVenda.reduce((s,i)=>s+(Number(i.preco_custo||0)*Number(i.quantidade)),0);
  const desconto = parseFloat(document.getElementById('f-desconto_total').value||0);
  const final = Math.max(0,totalProd-desconto);
  const status = document.getElementById('f-status_entrega').value || 'PENDENTE';

  const dadosVenda = {
    codigo_venda: codigo,
    id_cliente: parseInt(id_cliente),
    data_venda: new Date(data_venda).toISOString(),
    status_entrega: status,
    data_entrega: document.getElementById('f-data_entrega').value ? new Date(document.getElementById('f-data_entrega').value).toISOString() : null,
    valor_produtos: totalCusto,
    desconto_total: desconto,
    valor_final: final,
    meio_pagamento: document.getElementById('f-meio_pagamento').value || null,  // banco aceita: PIX,BOLETO,DINHEIRO,CARTAO
    data_vencimento: document.getElementById('f-data_vencimento').value || null,
    observacoes: document.getElementById('f-observacoes').value.trim()||null
  };

  let vendaId = currentId;

  if(isNew) {
    const{ok,data:res}=await apiPost('vendas',dadosVenda);
    if(!ok){ toast('Erro ao salvar venda: '+(res?.message||'erro'),'error'); btn.disabled=false; btn.textContent='+ Registrar Venda'; return; }
    vendaId = (Array.isArray(res)?res[0]:res)?.id_venda;
    const itensRes = await insertVendaItens(vendaId);
    if(!itensRes.ok) {
      await apiDelete(`vendas?id_venda=eq.${vendaId}`);
      toast('Erro ao salvar itens da venda: '+(itensRes.data?.message||'erro'),'error');
      btn.disabled=false; btn.textContent='+ Registrar Venda';
      return;
    }
  } else {
    const itensAnteriores = await apiGet(`venda_itens?select=id_produto,quantidade,preco_unitario,desconto_item&id_venda=eq.${currentId}`);
    const{ok,data:res}=await apiPatch(`vendas?id_venda=eq.${currentId}`,dadosVenda);
    if(!ok){ toast('Erro: '+(res?.message||'erro'),'error'); btn.disabled=false; btn.textContent='✓ Salvar Alterações'; return; }
    // Só deletar e reinserir itens se houver itens na tela
    if(itensVenda.length === 0) {
      toast('Atenção: nenhum item na venda. Adicione itens antes de salvar.','error');
      btn.disabled=false; btn.textContent='✓ Salvar Alterações';
      return;
    }
    const deleteOk = await apiDelete(`venda_itens?id_venda=eq.${currentId}`);
    if(!deleteOk) {
      toast('Erro ao preparar atualização dos itens. Tente novamente.','error');
      btn.disabled=false; btn.textContent='✓ Salvar Alterações';
      return;
    }
    const itensRes = await insertVendaItens(vendaId);
    if(!itensRes.ok) {
      let restaurado = false;
      if(Array.isArray(itensAnteriores) && itensAnteriores.length) {
        const restoreRes = await insertVendaItens(vendaId, itensAnteriores);
        restaurado = restoreRes.ok;
      }
      toast(restaurado
        ? 'Erro ao salvar itens da venda. Itens anteriores foram restaurados. '+(itensRes.data?.message||'')
        : 'Erro ao salvar itens da venda. Verifique os itens antes de continuar. '+(itensRes.data?.message||''),'error');
      btn.disabled=false; btn.textContent='✓ Salvar Alterações';
      return;
    }
  }

  toast(isNew?'Venda registrada!':'Venda atualizada!','success');
  
  // Salvar itens atuais antes de recarregar
  const itensAtual = [...itensVenda];
  const isNovoSalvo = isNew;
  
  await loadItems();
  
  // Restaurar itens e abrir o pedido sem recarregar do banco
  itensVenda = itensAtual;
  currentId = vendaId;
  isNew = false;
  
  // Atualizar apenas a sidebar e o botão salvar, sem recriar o form
  renderList();
  const btnSave = document.getElementById('btn-save');
  if(btnSave) { btnSave.disabled=false; btnSave.textContent='✓ Salvar Alterações'; }
  
  // Atualizar header
  const venda = items.find(v=>v.id_venda===vendaId);
  if(venda) showHeader(venda.codigo_venda||`Venda #${vendaId}`, `#${vendaId}`, `cadastrado em ${new Date(venda.data_cadastro||Date.now()).toLocaleDateString('pt-BR')}`);
}

async function marcarEntregue(idVenda) {
  await loadCacheCobrancas();

  // Modal de confirmação de entrega
  const pagOpts = cacheCobrancas.map(t=>`<option value="${t.descricao}">${t.descricao}</option>`).join('');
  const modalHtml = `
    <div class="modal-overlay" id="entrega-modal" style="display:flex;">
      <div class="modal" style="max-width:440px;">
        <div class="modal-header">
          <span class="modal-title">✅ Confirmar Entrega</span>
          <button class="modal-close" onclick="document.getElementById('entrega-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Data de Entrega</label>
            <input class="form-input" type="datetime-local" id="entrega-data" value="${new Date().toISOString().slice(0,16)}"/>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Meio de Pagamento</label>
            <select class="form-input form-select" id="entrega-pagamento">
              <option value="">Selecione...</option>
              ${pagOpts}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Data de Vencimento</label>
            <input class="form-input" type="date" id="entrega-vencimento" value="${new Date().toISOString().slice(0,10)}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Observações</label>
            <textarea class="form-textarea" id="entrega-obs" placeholder="Observações..." style="min-height:60px;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('entrega-modal').remove()">Cancelar</button>
          <button class="btn btn-primary" id="btn-confirmar-entrega" onclick="confirmarEntrega(${idVenda})">✅ Confirmar Entrega</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function confirmarEntrega(idVenda) {
  const dataEntrega = document.getElementById('entrega-data').value;
  const pagamento = document.getElementById('entrega-pagamento').value;
  const vencimento = document.getElementById('entrega-vencimento').value;
  const obs = document.getElementById('entrega-obs').value.trim();

  if(!pagamento){ toast('Selecione o meio de pagamento','error'); return; }
  const btn = document.getElementById('btn-confirmar-entrega');
  if(btn){ btn.disabled = true; btn.textContent = 'Confirmando...'; }

  // Atualizar venda
  const venda = items.find(x=>x.id_venda===idVenda);
  const vendaRes = await apiPatch(`vendas?id_venda=eq.${idVenda}`,{
    status_entrega:'ENTREGUE',
    data_entrega: dataEntrega ? new Date(dataEntrega).toISOString() : new Date().toISOString(),
    meio_pagamento: pagamento,
    data_vencimento: vencimento||null
  });
  if(!vendaRes.ok) {
    toast('Erro ao confirmar entrega: '+(vendaRes.data?.message||'erro'),'error');
    if(btn){ btn.disabled = false; btn.textContent = '✅ Confirmar Entrega'; }
    return;
  }

  // Criar ou atualizar conta a receber da venda, evitando duplicidade.
  const contaData = {
    id_venda: idVenda,
    id_cliente: venda?.id_cliente,
    data_vencimento: vencimento || new Date().toISOString().slice(0,10),
    valor_original: venda?.valor_final || 0,
    meio_pagamento: pagamento,
    status_recebimento: 'PENDENTE'
  };
  if(obs) contaData.observacoes = obs;
  const contasExistentes = await apiGet(`contas_receber?select=id_conta&id_venda=eq.${idVenda}`);
  const contaRes = Array.isArray(contasExistentes) && contasExistentes.length > 0
    ? await apiPatch(`contas_receber?id_venda=eq.${idVenda}`, contaData)
    : await apiPost('contas_receber', contaData);
  if(!contaRes.ok) {
    console.error('Erro ao salvar conta a receber:', contaRes.data);
    toast('Entrega confirmada mas houve erro ao gerar conta a receber: '+(contaRes.data?.message||''),'error');
    if(btn){ btn.disabled = false; btn.textContent = '✅ Confirmar Entrega'; }
    return;
  }

  if(venda?.status_entrega !== 'ENTREGUE') {
    const estoqueRes = await ajustarEstoqueVenda(idVenda, 'baixar');
    if(!estoqueRes.ok) {
      toast('Entrega confirmada, mas houve erro ao baixar estoque: '+estoqueRes.message,'error');
    }
  }

  document.getElementById('entrega-modal')?.remove();
  toast('Entrega confirmada e conta a receber atualizada!','success');
  await loadItems();
  openItem(idVenda);
}

async function cancelarEntrega(idVenda) {
  const venda = items.find(x=>x.id_venda===idVenda);
  const codigo = venda?.codigo_venda ? ` ${venda.codigo_venda}` : '';
  if(!confirm(`Cancelar a entrega${codigo}? A venda voltará para PENDENTE e as contas a receber vinculadas serão excluídas.`)) return;

  const res = await apiPatch(`vendas?id_venda=eq.${idVenda}`,{
    status_entrega:'PENDENTE',
    data_entrega:null,
    meio_pagamento:null,
    data_vencimento:null
  });
  if(!res.ok) {
    toast('Erro ao cancelar entrega: '+(res.data?.message||'erro'),'error');
    return;
  }

  if(venda?.status_entrega === 'ENTREGUE') {
    const estoqueRes = await ajustarEstoqueVenda(idVenda, 'devolver');
    if(!estoqueRes.ok) {
      toast('Entrega cancelada, mas houve erro ao devolver estoque: '+estoqueRes.message,'error');
    }
  }

  const contasOk = await apiDelete(`contas_receber?id_venda=eq.${idVenda}`);
  if(!contasOk) {
    toast('Entrega cancelada, mas houve erro ao excluir contas a receber.','error');
  } else {
    toast('Entrega cancelada e contas a receber removidas.','success');
  }

  await loadItems();
  openItem(idVenda);
}
