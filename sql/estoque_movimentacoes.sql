create table if not exists estoque_movimentacoes (
  id_movimentacao bigserial primary key,
  id_produto bigint not null references produtos(id_produto),
  tipo_movimentacao text not null,
  origem text not null default 'AJUSTE_MANUAL',
  quantidade numeric(12,2) not null,
  estoque_anterior numeric(12,2) not null,
  estoque_atual numeric(12,2) not null,
  observacoes text,
  id_usuario bigint references usuarios(id_usuario),
  data_movimentacao timestamptz not null default now(),
  constraint chk_estoque_tipo_movimentacao check (tipo_movimentacao in ('ENTRADA_AJUSTE','SAIDA_AJUSTE')),
  constraint chk_estoque_origem check (origem in ('AJUSTE_MANUAL')),
  constraint chk_estoque_quantidade check (quantidade > 0)
);

create index if not exists idx_estoque_mov_produto
  on estoque_movimentacoes(id_produto);

create index if not exists idx_estoque_mov_data
  on estoque_movimentacoes(data_movimentacao desc);

alter table estoque_movimentacoes disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on estoque_movimentacoes to anon, authenticated;
grant usage, select on sequence estoque_movimentacoes_id_movimentacao_seq to anon, authenticated;
