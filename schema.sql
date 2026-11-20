-- Ferreira's Cell - Schema do Banco de Dados

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  papel VARCHAR(20) DEFAULT 'tecnico', -- admin, tecnico, atendente
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(150),
  cpf VARCHAR(14),
  endereco TEXT,
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categorias_produto (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'peca' -- peca, acessorio
);

CREATE TABLE IF NOT EXISTS produtos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  categoria_id INT REFERENCES categorias_produto(id),
  preco_custo NUMERIC(10,2) DEFAULT 0,
  preco_venda NUMERIC(10,2) DEFAULT 0,
  estoque_atual INT DEFAULT 0,
  estoque_minimo INT DEFAULT 1,
  codigo_barras VARCHAR(50),
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordens_servico (
  id SERIAL PRIMARY KEY,
  numero VARCHAR(20) UNIQUE NOT NULL,
  cliente_id INT REFERENCES clientes(id),
  tecnico_id INT REFERENCES usuarios(id),
  aparelho_marca VARCHAR(80),
  aparelho_modelo VARCHAR(100),
  imei VARCHAR(20),
  defeito_relatado TEXT NOT NULL,
  diagnostico TEXT,
  solucao TEXT,
  status VARCHAR(30) DEFAULT 'aberta', -- aberta, aguardando_peca, em_reparo, pronto, entregue, cancelada
  valor_servico NUMERIC(10,2) DEFAULT 0,
  valor_pecas NUMERIC(10,2) DEFAULT 0,
  valor_total NUMERIC(10,2) DEFAULT 0,
  forma_pagamento VARCHAR(30),
  data_entrada TIMESTAMP DEFAULT NOW(),
  data_previsao DATE,
  data_conclusao TIMESTAMP,
  data_entrega TIMESTAMP,
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS os_pecas (
  id SERIAL PRIMARY KEY,
  ordem_id INT REFERENCES ordens_servico(id) ON DELETE CASCADE,
  produto_id INT REFERENCES produtos(id),
  quantidade INT DEFAULT 1,
  preco_unitario NUMERIC(10,2),
  subtotal NUMERIC(10,2)
);

CREATE TABLE IF NOT EXISTS vendas (
  id SERIAL PRIMARY KEY,
  cliente_id INT REFERENCES clientes(id),
  usuario_id INT REFERENCES usuarios(id),
  valor_total NUMERIC(10,2) DEFAULT 0,
  forma_pagamento VARCHAR(30),
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venda_itens (
  id SERIAL PRIMARY KEY,
  venda_id INT REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id INT REFERENCES produtos(id),
  quantidade INT DEFAULT 1,
  preco_unitario NUMERIC(10,2),
  subtotal NUMERIC(10,2)
);

CREATE TABLE IF NOT EXISTS caixa (
  id SERIAL PRIMARY KEY,
  usuario_id INT REFERENCES usuarios(id),
  data_abertura TIMESTAMP DEFAULT NOW(),
  data_fechamento TIMESTAMP,
  valor_abertura NUMERIC(10,2) DEFAULT 0,
  valor_fechamento NUMERIC(10,2),
  status VARCHAR(10) DEFAULT 'aberto' -- aberto, fechado
);

CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
  id SERIAL PRIMARY KEY,
  caixa_id INT REFERENCES caixa(id),
  tipo VARCHAR(10) NOT NULL, -- entrada, saida
  categoria VARCHAR(50),
  descricao VARCHAR(200),
  valor NUMERIC(10,2) NOT NULL,
  forma_pagamento VARCHAR(30),
  referencia_tipo VARCHAR(20), -- os, venda, manual
  referencia_id INT,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contas (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(10) NOT NULL, -- pagar, receber
  descricao VARCHAR(200) NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  data_vencimento DATE,
  data_pagamento DATE,
  status VARCHAR(20) DEFAULT 'pendente', -- pendente, pago, atrasado, cancelado
  categoria VARCHAR(50),
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Seed admin
INSERT INTO usuarios (nome, email, senha, papel) VALUES
  ('Admin', 'admin@ferreirascell.com', '$2a$10$placeholder', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Categorias padrão
INSERT INTO categorias_produto (nome, tipo) VALUES
  ('Telas / Frontais', 'peca'),
  ('Baterias', 'peca'),
  ('Conectores / Flex', 'peca'),
  ('Câmeras', 'peca'),
  ('Alto-falantes', 'peca'),
  ('Capinhas', 'acessorio'),
  ('Películas', 'acessorio'),
  ('Cabos / Carregadores', 'acessorio'),
  ('Fones de ouvido', 'acessorio'),
  ('Outros acessórios', 'acessorio')
ON CONFLICT DO NOTHING;
