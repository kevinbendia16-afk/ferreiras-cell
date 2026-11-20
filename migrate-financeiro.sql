-- Tabela de compras (pedidos a fornecedores)
CREATE TABLE IF NOT EXISTS compras (
  id SERIAL PRIMARY KEY,
  fornecedor VARCHAR(200) NOT NULL,
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  data_pagamento DATE,
  status VARCHAR(20) DEFAULT 'pendente',
  forma_pagamento VARCHAR(50),
  valor_total NUMERIC(10,2) DEFAULT 0,
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Itens de cada compra
CREATE TABLE IF NOT EXISTS compra_itens (
  id SERIAL PRIMARY KEY,
  compra_id INTEGER REFERENCES compras(id) ON DELETE CASCADE,
  produto_id INTEGER REFERENCES produtos(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Custos fixos mensais
CREATE TABLE IF NOT EXISTS custos_fixos (
  id SERIAL PRIMARY KEY,
  descricao VARCHAR(200) NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  dia_vencimento INTEGER DEFAULT 1,
  categoria VARCHAR(100),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);
