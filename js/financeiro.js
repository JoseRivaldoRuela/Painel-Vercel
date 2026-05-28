// =====================
// CONTAS A RECEBER
// =====================
async function renderFormConta(c) {
  await loadCacheCobrancas();
  // Buscar código da venda separadamente
  let codigoVenda = '';
  if(c?.id_venda) {
    const vRef = await apiGet('vendas?select=codigo_venda&id_venda=eq.'+c.id_venda);
    if(Array.isArray(vRef) && vRef[0]) codigoVenda = vRef[0].codigo_venda;
  }
  const v = f => c ? (c[f]??'') : '';
  const pagOpts = cacheCobrancas.map(t =>
    `<option value="${t.descricao}" ${v('meio_pagamento')===t.descricao?'selected':''}>${t.descricao}</option>`).join('');
  const statusOpts = ['PENDENTE','RECEBIDO'].map(s =>
    `<option value="${s}" ${(v('status_recebimento')||'Pendente')===s?'selected':''}>${s}</option>`).join('');

  const vencDate = c?.data_vencimento ? new Date(c.data_vencimento) : new Date();
  const hoje = new Date();
  const atrasado = c && c.status_recebimento !== 'RECEBIDO' && vencDate < hoje;

  document.getElementById('content-body').innerHTML = `
    <div class="section-label"><span>Dados da Conta</span></div>
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Cliente</label>
        <input class="form-input" value="${c?.clientes?.nome_fantasia||c?.clientes?.razao_social||''}" readonly style="color:var(--text2);"/>
      </div>
      <div class="form-group">
        <label class="form-label">Venda Referência</label>
        <input class="form-input" value="${codigoVenda||(c?.id_venda?`Venda #${c.id_venda}`:'')}" readonly style="color:var(--text2);"/>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-input form-select" id="f-status_recebimento">${statusOpts}</select>
      </div>
    </div>

    <div class="section-label"><span>Valores</span></div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Valor Original (R$)</label>
        <input class="form-input" type="number" step="0.01" id="f-valor_original" value="${v('valor_original')}" placeholder="0,00"/>
      </div>
      <div class="form-group">
        <label class="form-label">Valor Recebido (R$)</label>
        <input class="form-input" type="number" step="0.01" id="f-valor_recebido" value="${v('valor_recebido')}" placeholder="0,00"/>
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
        <label class="form-label">Data de Vencimento ${atrasado?'<span style="color:var(--danger)">⚠️ VENCIDA</span>':''}</label>
        <input class="form-input" type="date" id="f-data_vencimento" value="${v('data_vencimento')}" style="${atrasado?'border-color:var(--danger);':''}"/>
      </div>
      <div class="form-group">
        <label class="form-label">Data de Recebimento</label>
        <input class="form-input" type="datetime-local" id="f-data_recebimento" value="${v('data_recebimento')?v('data_recebimento').slice(0,16):''}"/>
      </div>
    </div>

    <div class="section-label"><span>Observações</span></div>
    <div class="form-group">
      <textarea class="form-textarea" id="f-observacoes" placeholder="Observações...">${v('observacoes')}</textarea>
    </div>

    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="saveConta()">✓ Salvar</button>
      ${c?.status_recebimento !== 'RECEBIDO' ? `<button class="btn btn-primary" style="background:var(--accent2);" onclick="marcarRecebido()">💰 Marcar Recebido</button>` : '<span class="pill on" style="padding:8px 14px;font-size:12px;">💰 Recebido</span>'}
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;
}

async function saveConta() {
  const btn = document.getElementById('btn-save');
  btn.disabled=true; btn.textContent='Salvando...';
  const statusSalvo = document.getElementById('f-status_recebimento').value.toUpperCase();
  const data = {
    status_recebimento: statusSalvo === 'VENCIDO' ? 'PENDENTE' : statusSalvo,
    valor_original: parseFloat(document.getElementById('f-valor_original').value||0),
    valor_recebido: parseFloat(document.getElementById('f-valor_recebido').value||0)||null,
    meio_pagamento: document.getElementById('f-meio_pagamento').value||null,
    data_vencimento: document.getElementById('f-data_vencimento').value||null,
    data_recebimento: document.getElementById('f-data_recebimento').value ? new Date(document.getElementById('f-data_recebimento').value).toISOString() : null,
    observacoes: document.getElementById('f-observacoes').value.trim()||null
  };
  const{ok,data:res}=await apiPatch(`contas_receber?id_conta=eq.${currentId}`,data);
  if(ok){ toast('Conta atualizada!','success'); await loadItems(); openItem(currentId); }
  else{ toast('Erro: '+(res?.message||'erro'),'error'); btn.disabled=false; btn.textContent='✓ Salvar'; }
}

async function marcarRecebido() {
  const hoje = new Date().toISOString();
  const data = {
    status_recebimento: 'RECEBIDO',
    valor_recebido: parseFloat(document.getElementById('f-valor_original').value||0),
    data_recebimento: hoje,
    meio_pagamento: document.getElementById('f-meio_pagamento').value||null
  };
  const{ok}=await apiPatch(`contas_receber?id_conta=eq.${currentId}`,data);
  if(ok){ toast('Pagamento confirmado!','success'); await loadItems(); openItem(currentId); }
  else toast('Erro ao confirmar','error');
}


// =====================
// DASHBOARD CONTAS A RECEBER
// =====================
async function renderDashboardContas() {
  const body = document.getElementById('content-body');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando análises...</div>';

  const contas = await apiGet('contas_receber?select=*,clientes!fk_conta_cliente(nome_fantasia,razao_social)&order=data_vencimento.asc');
  if(!Array.isArray(contas)) { body.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div><p>Erro ao carregar dados</p></div>'; return; }

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const fmt = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  // Classificar contas
  const recebidas   = contas.filter(c => c.status_recebimento === 'RECEBIDO');
  const pendentes   = contas.filter(c => c.status_recebimento !== 'RECEBIDO');
  const vencidas    = pendentes.filter(c => new Date(c.data_vencimento) < hoje);
  const d7          = pendentes.filter(c => { const d=new Date(c.data_vencimento); return d>=hoje && d<=new Date(hoje.getTime()+7*864e5); });
  const d15         = pendentes.filter(c => { const d=new Date(c.data_vencimento); return d>new Date(hoje.getTime()+7*864e5) && d<=new Date(hoje.getTime()+15*864e5); });
  const d30         = pendentes.filter(c => { const d=new Date(c.data_vencimento); return d>new Date(hoje.getTime()+15*864e5) && d<=new Date(hoje.getTime()+30*864e5); });
  const mais30      = pendentes.filter(c => new Date(c.data_vencimento) > new Date(hoje.getTime()+30*864e5));

  const soma = arr => arr.reduce((s,c)=>s+Number(c.valor_original||0),0);
  const totalGeral = soma(pendentes) + soma(recebidas);

  body.innerHTML = `
    <!-- Cards -->
    <div class="dash-grid dash-grid-3" style="margin-bottom:16px;">
      <div class="dash-card green" onclick="listarContas(null,'Todas Recebidas')">
        <div class="dash-card-label">✅ Recebido</div>
        <div class="dash-card-value">${fmt(soma(recebidas))}</div>
        <div class="dash-card-sub">${recebidas.length} conta${recebidas.length!==1?'s':''}</div>
      </div>
      <div class="dash-card red" onclick="listarContas('vencido','Vencidas')">
        <div class="dash-card-label">🔴 Vencidas</div>
        <div class="dash-card-value">${fmt(soma(vencidas))}</div>
        <div class="dash-card-sub">${vencidas.length} conta${vencidas.length!==1?'s':''}</div>
      </div>
      <div class="dash-card orange" onclick="listarContas('pendente','Em Aberto')">
        <div class="dash-card-label">⏳ Total em Aberto</div>
        <div class="dash-card-value">${fmt(soma(pendentes))}</div>
        <div class="dash-card-sub">${pendentes.length} conta${pendentes.length!==1?'s':''}</div>
      </div>
    </div>

    <!-- Gráfico + Vencimentos -->
    <div class="dash-charts" style="margin-bottom:16px;">
      <div class="dash-chart-box">
        <div class="dash-chart-title"><span>📊 Distribuição por Status</span></div>
        <div class="dash-canvas-wrap sm"><canvas id="chart-contas"></canvas></div>
      </div>

      <div class="dash-chart-box">
        <div class="dash-chart-title"><span>📅 Vencimentos em Aberto</span></div>
        <div class="dash-list">
          <div class="dash-list-item" onclick="listarContas('vencido','Vencidas')">
            <span class="dash-list-rank" style="color:var(--danger);">!</span>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;">
                <span class="dash-list-name" style="color:var(--danger);">Vencidas</span>
                <span class="dash-list-value" style="color:var(--danger);">${fmt(soma(vencidas))}</span>
              </div>
              <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${totalGeral>0?(soma(vencidas)/totalGeral*100).toFixed(0):0}%;background:var(--danger)"></div></div>
            </div>
          </div>
          <div class="dash-list-item" onclick="listarContas('7dias','Vencem em 7 dias')">
            <span class="dash-list-rank" style="color:var(--warn);">7d</span>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;">
                <span class="dash-list-name">Próximos 7 dias</span>
                <span class="dash-list-value">${fmt(soma(d7))}</span>
              </div>
              <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${totalGeral>0?(soma(d7)/totalGeral*100).toFixed(0):0}%;background:var(--warn)"></div></div>
            </div>
          </div>
          <div class="dash-list-item" onclick="listarContas('15dias','Vencem em 8-15 dias')">
            <span class="dash-list-rank">15d</span>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;">
                <span class="dash-list-name">8 a 15 dias</span>
                <span class="dash-list-value">${fmt(soma(d15))}</span>
              </div>
              <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${totalGeral>0?(soma(d15)/totalGeral*100).toFixed(0):0}%;background:var(--accent2)"></div></div>
            </div>
          </div>
          <div class="dash-list-item" onclick="listarContas('30dias','Vencem em 16-30 dias')">
            <span class="dash-list-rank">30d</span>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;">
                <span class="dash-list-name">16 a 30 dias</span>
                <span class="dash-list-value">${fmt(soma(d30))}</span>
              </div>
              <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${totalGeral>0?(soma(d30)/totalGeral*100).toFixed(0):0}%;background:var(--accent)"></div></div>
            </div>
          </div>
          <div class="dash-list-item" onclick="listarContas('mais30','Mais de 30 dias')">
            <span class="dash-list-rank">+30</span>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;">
                <span class="dash-list-name">Mais de 30 dias</span>
                <span class="dash-list-value">${fmt(soma(mais30))}</span>
              </div>
              <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${totalGeral>0?(soma(mais30)/totalGeral*100).toFixed(0):0}%;background:var(--text3)"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Top clientes inadimplentes -->
    <div class="dash-chart-box">
      <div class="dash-chart-title"><span>👥 Maiores Valores em Aberto por Cliente</span></div>
      <div class="dash-two-col" id="dash-inadim">
        ${(() => {
          const clienteMap = {};
          pendentes.forEach(c => {
            const nome = c.clientes?.nome_fantasia||c.clientes?.razao_social||`Cliente #${c.id_cliente}`;
            if(!clienteMap[nome]) clienteMap[nome]={nome,total:0,qtd:0};
            clienteMap[nome].total+=Number(c.valor_original||0);
            clienteMap[nome].qtd++;
          });
          const top = Object.values(clienteMap).sort((a,b)=>b.total-a.total).slice(0,6);
          if(!top.length) return '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;grid-column:1/-1;">Nenhum valor em aberto</div>';
          return top.map((c,i)=>`
            <div class="dash-list-item">
              <span class="dash-list-rank">${i+1}</span>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span class="dash-list-name">${c.nome}</span>
                  <span class="dash-list-value">${fmt(c.total)}</span>
                </div>
                <div style="font-size:11px;color:var(--text2);">${c.qtd} conta${c.qtd!==1?'s':''}</div>
                <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${top[0].total>0?(c.total/top[0].total*100).toFixed(0):0}%;background:var(--warn)"></div></div>
              </div>
            </div>`).join('');
        })()}
      </div>
    </div>`;

  // Gráfico de pizza
  setTimeout(() => {
    const ctx = document.getElementById('chart-contas');
    if(!ctx) return;
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Recebido','Vencido','7 dias','8-15 dias','16-30 dias','+30 dias'],
        datasets: [{
          data: [soma(recebidas), soma(vencidas), soma(d7), soma(d15), soma(d30), soma(mais30)],
          backgroundColor: ['rgba(0,229,160,.7)','rgba(255,71,87,.7)','rgba(255,165,0,.7)','rgba(0,122,255,.7)','rgba(0,229,160,.4)','rgba(136,136,160,.4)'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position:'bottom', labels:{ color:'#8888a0', font:{size:11}, padding:12 } },
          tooltip: { callbacks: { label: ctx => ctx.label+': '+fmt(ctx.raw) } }
        }
      }
    });
  }, 100);
}

function listarContas(filtro, titulo) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const fmt = n => 'R$ '+Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  let lista = [...items];

  if(filtro==='vencido') lista=lista.filter(c=>c.status_recebimento!=='RECEBIDO'&&new Date(c.data_vencimento)<hoje);
  else if(filtro==='pendente') lista=lista.filter(c=>c.status_recebimento!=='RECEBIDO');
  else if(filtro==='7dias') lista=lista.filter(c=>{const d=new Date(c.data_vencimento);return c.status_recebimento!=='RECEBIDO'&&d>=hoje&&d<=new Date(hoje.getTime()+7*864e5);});
  else if(filtro==='15dias') lista=lista.filter(c=>{const d=new Date(c.data_vencimento);return c.status_recebimento!=='RECEBIDO'&&d>new Date(hoje.getTime()+7*864e5)&&d<=new Date(hoje.getTime()+15*864e5);});
  else if(filtro==='30dias') lista=lista.filter(c=>{const d=new Date(c.data_vencimento);return c.status_recebimento!=='RECEBIDO'&&d>new Date(hoje.getTime()+15*864e5)&&d<=new Date(hoje.getTime()+30*864e5);});
  else if(filtro==='mais30') lista=lista.filter(c=>c.status_recebimento!=='RECEBIDO'&&new Date(c.data_vencimento)>new Date(hoje.getTime()+30*864e5));
  else if(filtro===null) lista=lista.filter(c=>c.status_recebimento==='RECEBIDO');

  const total = lista.reduce((s,c)=>s+Number(c.valor_original||0),0);

  document.getElementById('content-body').innerHTML = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <button onclick="renderDashboardContas()" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:12px;padding:5px 12px;cursor:pointer;">← Voltar</button>
      <span style="font-size:15px;font-weight:600;">${titulo}</span>
      <span style="font-size:12px;color:var(--text2);margin-left:auto;">${lista.length} conta${lista.length!==1?'s':''} · ${fmt(total)}</span>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Cliente</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Vencimento</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Pagamento</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Status</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Valor</th>
        </tr></thead>
        <tbody>
          ${lista.length===0?'<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text3);">Nenhuma conta encontrada</td></tr>':
          lista.map(c=>{
            const venc=new Date(c.data_vencimento);
            const atras=c.status_recebimento!=='RECEBIDO'&&venc<hoje;
            const sc=c.status_recebimento==='RECEBIDO'?'on':atras?'vencido':'warn';
            const sl=c.status_recebimento==='RECEBIDO'?'RECEBIDO':atras?'VENCIDO':'PENDENTE';
            return `<tr style="border-top:1px solid var(--border);cursor:pointer;" onclick="openItem(${c.id_conta})" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
              <td style="padding:10px 14px;">${c.clientes?.nome_fantasia||c.clientes?.razao_social||'-'}</td>
              <td style="padding:10px 14px;text-align:center;color:${atras?'var(--danger)':'var(--text2)'};">${venc.toLocaleDateString('pt-BR')}</td>
              <td style="padding:10px 14px;text-align:center;color:var(--text2);">${c.meio_pagamento||'-'}</td>
              <td style="padding:10px 14px;text-align:center;"><span class="pill ${sc}">${sl}</span></td>
              <td style="padding:10px 14px;text-align:right;font-weight:600;color:var(--accent);font-family:var(--mono);">${fmt(c.valor_original)}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr style="border-top:2px solid var(--border);background:var(--surface2);">
          <td colspan="4" style="padding:10px 14px;font-weight:600;">Total</td>
          <td style="padding:10px 14px;text-align:right;font-weight:700;color:var(--accent);font-family:var(--mono);">${fmt(total)}</td>
        </tr></tfoot>
      </table>
    </div>`;
}

// FORM CLIENTES / FORNECEDORES
