// MENU
function toggleMenu(name) {
  document.querySelectorAll('.dropdown').forEach(d => { if(d.id!=='dd-'+name) d.classList.remove('open'); });
  document.querySelectorAll('.menu-btn').forEach(b => { if(b.id!=='mbtn-'+name) b.classList.remove('open'); });
  document.getElementById('dd-'+name)?.classList.toggle('open');
  document.getElementById('mbtn-'+name)?.classList.toggle('open');
}
function closeMenus() {
  document.querySelectorAll('.dropdown').forEach(d=>d.classList.remove('open'));
  document.querySelectorAll('.menu-btn').forEach(b=>b.classList.remove('open'));
}
document.addEventListener('click', e => { 
  if(!e.target.closest('.menu-group')) closeMenus(); 
});

function setActiveMenu(tab) {
  document.querySelectorAll('.menu-btn,.dropdown-item').forEach(el=>el.classList.remove('active'));
  const menuMap = { vendas:'vendas', contas_receber:'contas_receber', clientes:'cadastros', fornecedores:'cadastros', tipo_mercadoria:'produtos', produtos_tab:'produtos', precos_especiais:'produtos', estoque_movimentacoes:'produtos', usuarios:'config' };
  const main = menuMap[tab];
  if(main) document.getElementById('mbtn-'+main)?.classList.add('active');
  document.getElementById('di-'+tab)?.classList.add('active');
  if(tab==='usuarios') document.getElementById('mbtn-usuarios')?.classList.add('active');
}

// TAB SWITCH
async function switchTab(tab) {
  if(tab==='usuarios' && !isAdmin){ toast('Acesso restrito ao administrador.','error'); return; }
  currentTab=tab; currentId=null; isNew=false;
  const cfg=tabConfig[tab];
  document.getElementById('topbar-title').textContent=cfg.plural;
  document.getElementById('btn-novo').textContent='+ '+cfg.label;
  document.getElementById('btn-cnpj').style.display=cfg.hasCNPJ?'block':'none';
  document.getElementById('search-input').value='';
  document.getElementById('content-header').style.display='none';
  if(tab==='vendas') {
    document.getElementById('content-body').innerHTML='<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando dashboard...</div>';
    setActiveMenu(tab);
    await loadItems();
    await renderDashboard();
  } else if(tab==='contas_receber') {
    document.getElementById('content-body').innerHTML='<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando análises...</div>';
    setActiveMenu(tab);
    await loadItems();
    await renderDashboardContas();
  } else {
    document.getElementById('content-body').innerHTML=`<div class="empty-state"><div class="empty-icon">${cfg.hasCNPJ?'👥':'📦'}</div><p>Selecione um ${cfg.label.toLowerCase()} ou crie um novo</p></div>`;
    setActiveMenu(tab);
    await loadItems();
  }
}

// LOAD
async function loadItems() {
  const cfg=tabConfig[currentTab];
  document.getElementById('item-list').innerHTML='<div class="loading"><div class="spinner"></div> Carregando...</div>';
  let sel='*';
  if(currentTab==='contas_receber') sel='*,clientes!fk_conta_cliente(nome_fantasia,razao_social)';
  if(currentTab==='vendas') sel='*,clientes(nome_fantasia,razao_social)';
  if(currentTab==='produtos_tab') sel='*,tipo_mercadoria(descricao),fornecedores(nome_fantasia,razao_social)';
  if(currentTab==='precos_especiais') sel='*,clientes(nome_fantasia,razao_social),produtos(nome_mercadoria)';
  if(currentTab==='estoque_movimentacoes') sel='*,produtos(nome_mercadoria,estoque_atual)';
  let orderParam = `${cfg.order}.asc`;
  if(currentTab==='vendas') orderParam = 'status_entrega.asc,data_entrega.asc,id_venda.asc';
  if(currentTab==='estoque_movimentacoes') orderParam = 'data_movimentacao.desc,id_movimentacao.desc';
  const data=await apiGet(`${cfg.table}?select=${sel}&order=${orderParam}`);
  if(!Array.isArray(data)){ toast('Erro ao carregar: '+(data?.message||''),'error'); return; }
  // Ordenar: pendentes primeiro por data_entrega asc, entregues depois por data_entrega asc
  if(currentTab==='vendas') {
    data.sort((a,b) => {
      const aPend = a.status_entrega !== 'ENTREGUE';
      const bPend = b.status_entrega !== 'ENTREGUE';
      if(aPend && !bPend) return -1;
      if(!aPend && bPend) return 1;
      // Mesmo grupo - ordenar por data_entrega asc
      const dA = a.data_entrega || a.data_venda || '';
      const dB = b.data_entrega || b.data_venda || '';
      return dA < dB ? -1 : dA > dB ? 1 : 0;
    });
  }
  items=data; filtered=[...items];
  renderList();
  document.getElementById('sidebar-footer').textContent=`${items.length} ${cfg.plural.toLowerCase()}`;
  const badge=document.getElementById('badge-'+currentTab);
  if(badge) badge.textContent=items.length;
}

function cardVenda(c) {
  const se = (c.status_entrega||'').toUpperCase();
  const statusColor = se==='ENTREGUE'?'on':se==='CANCELADO'?'off':'warn';
  const slabel = se==='ENTREGUE'?'Entregue':se==='CANCELADO'?'Cancelado':'Pendente';
  const nomeCliente = c.clientes?.nome_fantasia||c.clientes?.razao_social||'';
  const dtV = c.data_venda ? new Date(c.data_venda).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '';
  const dtE = c.data_entrega ? new Date(c.data_entrega).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '';
  const valorFinal = Number(c.valor_final||0);
  const valorCusto = Number(c.valor_produtos||0);
  const lucro = valorFinal - valorCusto;
  const temLucro = valorCusto > 0;
  const lucroColor = lucro >= 0 ? '#22c55e' : '#ef4444';
  const valorVenda = valorFinal > 0 ? 'R$ '+valorFinal.toFixed(2) : '';
  return `<div class="item-card ${currentId===c.id_venda?'active':''}" onclick="openItem(${c.id_venda})">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
      <span style="font-size:13px;font-weight:500;font-family:var(--mono);color:var(--accent);">${c.codigo_venda||'#'+c.id_venda}</span>
      <span class="pill ${statusColor}" style="font-size:9px;padding:1px 6px;">${slabel}</span>
    </div>
    <div style="font-size:12px;color:var(--text);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nomeCliente}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
      <span style="font-size:10px;color:var(--text3);">🛒${dtV}${dtE?' 📦'+dtE:''}</span>
      <span style="font-size:11px;font-weight:600;color:var(--accent);font-family:var(--mono);">${valorVenda}</span>
    </div>
    ${temLucro ? `<div style="display:flex;justify-content:flex-end;margin-top:2px;">
      <span style="font-size:10px;font-weight:600;color:${lucroColor};font-family:var(--mono);">📈 ${lucro>=0?'':'- '}R$ ${Math.abs(lucro).toFixed(2)}</span>
    </div>` : ''}
  </div>`;
}

function renderListVendas(el) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const hojeStr = hoje.toISOString().slice(0,10);
  const semana = new Date(hoje.getTime()-7*864e5).toISOString().slice(0,10);
  const mes = new Date(hoje.getFullYear(),hoje.getMonth(),1).toISOString().slice(0,10);
  const ano = new Date(hoje.getFullYear(),0,1).toISOString().slice(0,10);

  const pendentes = filtered.filter(v=>v.status_entrega!=='ENTREGUE'&&v.status_entrega!=='CANCELADO');
  const entregues = filtered.filter(v=>v.status_entrega==='ENTREGUE'||v.status_entrega==='CANCELADO');

  // Filtrar entregues conforme filtro selecionado
  let entreguesFiltrados = [];
  let btnLabel = '';
  if(vendaFiltro==='padrao') {
    entreguesFiltrados = entregues.filter(v=>(v.data_entrega||v.data_venda||'').slice(0,10)===hojeStr);
    btnLabel = null; // mostrar botões
  } else if(vendaFiltro==='semana') {
    entreguesFiltrados = entregues.filter(v=>(v.data_entrega||v.data_venda||'').slice(0,10)>=semana);
  } else if(vendaFiltro==='mes') {
    entreguesFiltrados = entregues.filter(v=>(v.data_entrega||v.data_venda||'').slice(0,10)>=mes);
  } else if(vendaFiltro==='ano') {
    entreguesFiltrados = entregues.filter(v=>(v.data_entrega||v.data_venda||'').slice(0,10)>=ano);
  } else {
    entreguesFiltrados = entregues;
  }

  let html = '';

  // Pendentes
  if(pendentes.length) {
    html += `<div style="font-size:10px;color:var(--warn);font-family:var(--mono);padding:8px 12px 4px;letter-spacing:.05em;font-weight:600;">⏳ PENDENTES (${pendentes.length})</div>`;
    html += pendentes.map(c=>cardVenda(c)).join('');
  }

  // Entregues
  const labelEntregues = vendaFiltro==='padrao'?'HOJE':vendaFiltro==='semana'?'ÚLTIMOS 7 DIAS':vendaFiltro==='mes'?'ESTE MÊS':vendaFiltro==='ano'?'ESTE ANO':'TODOS';
  if(entreguesFiltrados.length) {
    html += `<div style="font-size:10px;color:var(--text3);font-family:var(--mono);padding:8px 12px 4px;letter-spacing:.05em;border-top:1px solid var(--border);margin-top:6px;">✅ ENTREGUES — ${labelEntregues} (${entreguesFiltrados.length})</div>`;
    html += entreguesFiltrados.map(c=>cardVenda(c)).join('');
  } else if(vendaFiltro==='padrao' && entregues.length > 0) {
    html += `<div style="font-size:11px;color:var(--text3);padding:8px 12px;border-top:1px solid var(--border);margin-top:6px;">Nenhuma entrega hoje</div>`;
  }

  // Botões de filtro
  html += `<div style="padding:10px 8px;border-top:1px solid var(--border);margin-top:6px;">
    <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:6px;">MOSTRAR ENTREGUES:</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
      ${['padrao','semana','mes','ano','todos'].map((f,i)=>{
        const labels=['Hoje','7 dias','Mês','Ano','Todos'];
        return `<button onclick="vendaFiltro='${f}';renderList()" style="background:${vendaFiltro===f?'var(--accent)':'var(--surface2)'};color:${vendaFiltro===f?'#000':'var(--text2)'};border:1px solid var(--border);border-radius:6px;padding:5px 4px;font-size:11px;cursor:pointer;font-family:var(--mono);">${labels[i]}</button>`;
      }).join('')}
    </div>
  </div>`;

  el.innerHTML = html || '<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px;">Nenhuma venda</div>';
}

function filterItems() {
  const q=document.getElementById('search-input').value.toLowerCase();
  const fields=tabConfig[currentTab].searchFields;
  filtered=!q?[...items]:items.filter(c=>fields.some(f=>(c[f]||'').toLowerCase().includes(q)));
  renderList();
}

let vendaFiltro = 'padrao'; // padrao | semana | mes | ano | todos

function renderList() {
  const el=document.getElementById('item-list');
  const cfg=tabConfig[currentTab];
  if(!filtered.length){ el.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px;">Nenhum encontrado</div>'; return; }

  // VENDAS: lógica especial
  if(currentTab==='vendas') {
    renderListVendas(el);
    return;
  }
  el.innerHTML=filtered.map(c=>{
    let nome='',sub='',pills='';
    if(currentTab==='contas_receber'){
      const venc = new Date(c.data_vencimento);
      const hoje = new Date();
      const atrasado = c.status_recebimento!=='RECEBIDO' && venc < hoje;
      nome = c.clientes?.nome_fantasia||c.clientes?.razao_social||`Cliente #${c.id_cliente}`;
      sub = `Venc: ${venc.toLocaleDateString('pt-BR')} · R$ ${Number(c.valor_original||0).toFixed(2)}`;
      const sc = c.status_recebimento==='RECEBIDO'?'on':atrasado?'vencido':'warn';
      const slabel = c.status_recebimento==='RECEBIDO'?'RECEBIDO':atrasado?'VENCIDO':'PENDENTE';
      pills = `<span class="pill ${sc}">${slabel}</span>`;
    } else if(currentTab==='vendas'){
      // Tratado abaixo no bloco especial
    } else if(currentTab==='clientes'||currentTab==='fornecedores'){
      nome=c.nome_fantasia||c.razao_social;
      sub=`${c.cidade||'—'}, ${c.estado||'—'}`;
      pills=`<span class="pill ${c.ativo?'on':'off'}">${c.ativo?'ativo':'inativo'}</span>`;
    } else if(currentTab==='tipo_mercadoria'){
      nome=c.descricao; sub=`ID: ${c.id_tipo}`;
    } else if(currentTab==='produtos_tab'){
      nome=c.nome_mercadoria;
      sub=`${c.tipo_mercadoria?.descricao||''} · R$ ${Number(c.preco_venda||0).toFixed(2)}`;
      pills=`<span class="pill ${c.ativo?'on':'off'}">${c.ativo?'ativo':'inativo'}</span>`;
    } else if(currentTab==='precos_especiais'){
      nome=c.produtos?.nome_mercadoria||`Produto #${c.id_produto}`;
      sub=`${c.clientes?.nome_fantasia||c.clientes?.razao_social||''} · R$ ${Number(c.preco_especial||0).toFixed(2)}`;
    } else if(currentTab==='estoque_movimentacoes'){
      const tipo = c.tipo_movimentacao === 'ENTRADA_AJUSTE' ? 'Entrada por ajuste' : 'Saida por ajuste';
      const sinal = c.tipo_movimentacao === 'ENTRADA_AJUSTE' ? '+' : '-';
      nome=c.produtos?.nome_mercadoria||`Produto #${c.id_produto}`;
      sub=`${tipo} - ${sinal}${Number(c.quantidade||0).toFixed(2)} - Estoque: ${Number(c.estoque_anterior||0).toFixed(2)} -> ${Number(c.estoque_atual||0).toFixed(2)}`;
      pills=`<span class="pill ${c.tipo_movimentacao === 'ENTRADA_AJUSTE'?'on':'warn'}">${tipo}</span>`;
    } else if(currentTab==='usuarios'){
      nome=c.nome; sub=`@${c.username}`;
      pills=`<span class="pill ${c.ativo?'on':'off'}">${c.ativo?'ativo':'inativo'}</span>${c.admin?'<span class="pill adm">admin</span>':''}`;
    }
    return `<div class="item-card ${currentId===c[cfg.id]?'active':''}" onclick="openItem(${c[cfg.id]})">
      <div class="item-name">${nome}</div>
      <div class="item-sub">${pills}<span>${sub}</span></div>
    </div>`;
  }).join('');
}

function openItem(id) {
  id = typeof id === 'string' ? parseInt(id) : id;
  isNew=false; currentId=id;
  const cfg=tabConfig[currentTab];
  const c=items.find(x=>Number(x[cfg.id])===Number(id));
  if(!c) return;
  renderList();
  let titulo='';
  if(currentTab==='contas_receber') titulo=c.clientes?.nome_fantasia||c.clientes?.razao_social||`Conta #${c.id_conta}`;
  else if(currentTab==='vendas') titulo=c.codigo_venda||`Venda #${c.id_venda}`;
  else if(currentTab==='clientes'||currentTab==='fornecedores') titulo=c.nome_fantasia||c.razao_social;
  else if(currentTab==='tipo_mercadoria') titulo=c.descricao;
  else if(currentTab==='produtos_tab') titulo=c.nome_mercadoria;
  else if(currentTab==='precos_especiais') titulo=c.produtos?.nome_mercadoria||`Produto #${c.id_produto}`;
  else if(currentTab==='estoque_movimentacoes') titulo=c.produtos?.nome_mercadoria||`Movimentacao #${c.id_movimentacao}`;
  else if(currentTab==='usuarios') titulo=c.nome;
  const sub=c.data_cadastro?`cadastrado em ${new Date(c.data_cadastro).toLocaleDateString('pt-BR')}`:'';
  showHeader(titulo,`#${id}`,sub);
  renderForm(c);
  closeSidebar();
}

function openNew() {
  isNew=true; currentId=null;
  renderList();
  showHeader('Novo '+tabConfig[currentTab].label,'novo','');
  renderForm(null);
  closeSidebar();
}

function showHeader(t,id,sub) {
  document.getElementById('content-header').style.display='flex';
  document.getElementById('content-title').textContent=t;
  document.getElementById('content-id').textContent=id;
  document.getElementById('content-sub').textContent=sub;
}

async function cancelForm() {
  currentId=null; isNew=false; renderList();
  document.getElementById('content-header').style.display='none';
  if(currentTab==='vendas') {
    await renderDashboard();
  } else if(currentTab==='contas_receber') {
    await renderDashboardContas();
  } else {
    const cfg=tabConfig[currentTab];
    document.getElementById('content-body').innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><p>Selecione um ${cfg.label.toLowerCase()} ou crie um novo</p></div>`;
  }
}

// =====================
// FORMULÁRIOS
// =====================
function renderForm(c) {
  if(currentTab==='contas_receber') { renderFormConta(c); return; }
  if(currentTab==='vendas') { renderFormVenda(c); return; }
  if(currentTab==='clientes'||currentTab==='fornecedores') renderFormCadastro(c);
  else if(currentTab==='tipo_mercadoria') renderFormTipo(c);
  else if(currentTab==='produtos_tab') renderFormProduto(c);
  else if(currentTab==='precos_especiais') renderFormPreco(c);
  else if(currentTab==='estoque_movimentacoes') renderFormEstoque(c);
  else if(currentTab==='usuarios') renderFormUsuario(c);
}



// =====================
// DASHBOARD DE VENDAS
// =====================
let chartVendas = null;

function toggleSidebar(){ document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('open'); }
function closeSidebar(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('open'); }

function toast(msg,type='success'){
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.textContent=(type==='success'?'✓ ':type==='error'?'✕ ':'ℹ ')+msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(()=>el.remove(),3500);
}

function logout(){ sessionStorage.removeItem('usuario_logado'); location.href='/login.html'; }

// INIT
async function init(){
  document.getElementById('user-info').textContent=usuario?.nome||'';
  // Verificar admin direto no banco - campo id na sessão
  const uid = usuario?.id || usuario?.id_usuario;
  if(uid) {
    try {
      const uData = await apiGet('usuarios?select=admin&id_usuario=eq.'+uid);
      const adminNoBanco = Array.isArray(uData) && uData.length > 0 && uData[0].admin === true;
      if(adminNoBanco) {
        document.getElementById('menu-usuarios-wrap').style.display='block';
        document.getElementById('menu-config-wrap').style.display='block';
      }
    } catch(e) {
      // fallback para sessão
      if(isAdmin) {
        document.getElementById('menu-usuarios-wrap').style.display='block';
        document.getElementById('menu-config-wrap').style.display='block';
      }
    }
  } else if(isAdmin) {
    document.getElementById('menu-usuarios-wrap').style.display='block';
    document.getElementById('menu-config-wrap').style.display='block';
  }
  await loadCaches();
  await switchTab('vendas');
  // Carregar badges de todas as abas
  const[fv,fcr,fc,ff,ft,fp,fe,fem,fu]=await Promise.all([
    apiGet('vendas?select=id_venda'),
    apiGet('contas_receber?select=id_conta'),
    apiGet('clientes?select=id_cliente'),
    apiGet('fornecedores?select=id_fornecedor'),
    apiGet('tipo_mercadoria?select=id_tipo'),
    apiGet('produtos?select=id_produto'),
    apiGet('produtos_precos_especiais?select=id_preco_especial'),
    apiGet('estoque_movimentacoes?select=id_movimentacao'),
    isAdmin?apiGet('usuarios?select=id_usuario'):Promise.resolve([])
  ]);
  const setBadge=(id,data)=>{ const el=document.getElementById(id); if(el&&Array.isArray(data)) el.textContent=data.length; };
  setBadge('badge-vendas',fv);
  setBadge('badge-contas_receber',fcr);
  setBadge('badge-clientes',fc);
  setBadge('badge-fornecedores',ff);
  setBadge('badge-tipo_mercadoria',ft);
  setBadge('badge-produtos_tab',fp);
  setBadge('badge-precos_especiais',fe);
  setBadge('badge-estoque_movimentacoes',fem);
  if(isAdmin && Array.isArray(fu)) {
    setBadge('badge-usuarios',fu);
    const b2=document.getElementById('badge-usuarios2'); if(b2) b2.textContent=fu.length;
  }
}


init();
