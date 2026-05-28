// Sessão
const usuario = JSON.parse(sessionStorage.getItem('usuario_logado')||'null');
if (!usuario) location.href='/login.html';
const isAdmin = usuario?.admin === true || usuario?.admin === 'true' || usuario?.admin === 1;

// Estado
let currentTab='clientes', items=[], filtered=[], currentId=null, isNew=false;
let cnpjMode='new', cnpjSelected=null;
let cacheTipos=[], cacheFornecedores=[], cacheProdutos=[], cacheClientes=[];

// Config das abas
const tabConfig = {
  contas_receber:   { table:'contas_receber',          id:'id_conta',          label:'Conta a Receber',    plural:'Contas a Receber',    order:'id_conta', searchFields:['status_recebimento','meio_pagamento'], hasCNPJ:false, hasAtivo:false },
  vendas:           { table:'vendas',                  id:'id_venda',          label:'Venda',              plural:'Vendas',              order:'status_entrega', searchFields:['codigo_venda','status_entrega'], hasCNPJ:false, hasAtivo:false },
  clientes:         { table:'clientes',                   id:'id_cliente',        label:'Cliente',            plural:'Clientes',            order:'razao_social', searchFields:['razao_social','nome_fantasia','cidade','telefone'], hasCNPJ:true, hasAtivo:true },
  fornecedores:     { table:'fornecedores',               id:'id_fornecedor',     label:'Fornecedor',         plural:'Fornecedores',         order:'razao_social', searchFields:['razao_social','nome_fantasia','cidade','telefone'], hasCNPJ:true, hasAtivo:true },
  tipo_mercadoria:  { table:'tipo_mercadoria',            id:'id_tipo',           label:'Tipo de Mercadoria', plural:'Tipos de Mercadoria',  order:'descricao',    searchFields:['descricao'], hasCNPJ:false, hasAtivo:false },
  produtos_tab:     { table:'produtos',                   id:'id_produto',        label:'Produto',            plural:'Produtos',             order:'nome_mercadoria', searchFields:['nome_mercadoria'], hasCNPJ:false, hasAtivo:true },
  precos_especiais: { table:'produtos_precos_especiais',  id:'id_preco_especial', label:'Preço Especial',     plural:'Preços Especiais',     order:'id_preco_especial', searchFields:['observacoes'], hasCNPJ:false, hasAtivo:false },
  estoque_movimentacoes: { table:'estoque_movimentacoes', id:'id_movimentacao',   label:'Movimentação',       plural:'Movimentações de Estoque', order:'data_movimentacao', searchFields:['tipo_movimentacao','origem','observacoes'], hasCNPJ:false, hasAtivo:false },
  usuarios:         { table:'usuarios',                   id:'id_usuario',        label:'Usuário',            plural:'Usuários',             order:'nome',         searchFields:['nome','username'], hasCNPJ:false, hasAtivo:true }
};

let dashPeriodo = '7'; // dias
let itensVenda = []; // itens do pedido atual
let cacheCobrancas = [];
