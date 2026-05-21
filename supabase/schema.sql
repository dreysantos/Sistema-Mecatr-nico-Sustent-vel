create table if not exists leituras (
  id bigserial primary key,
  data_iso timestamptz not null default now(),
  horario text,
  nivel text,
  bomba text,
  corrente numeric,
  tensao_bateria numeric,
  carga_bateria numeric,
  tensao_solar numeric,
  alerta text,
  conexao text,
  simulado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists leituras_data_iso_idx
  on leituras (data_iso desc);
