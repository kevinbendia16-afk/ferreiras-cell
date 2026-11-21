require('dotenv').config();
const pool = require('./db');

async function migrate() {
  const queries = [
    // OS: sinal e custo real das peças
    "ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS valor_sinal NUMERIC(10,2) DEFAULT 0",
    "ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS custo_pecas NUMERIC(10,2) DEFAULT 0",
    // os_pecas: preço de custo para calcular lucro
    "ALTER TABLE os_pecas ADD COLUMN IF NOT EXISTS preco_custo NUMERIC(10,2) DEFAULT 0",
    // compras: tabela já existe
  ];
  for (const q of queries) {
    try { await pool.query(q); console.log('OK:', q.substring(0, 60)); }
    catch (e) { console.log('Skip:', e.message.substring(0, 80)); }
  }
  console.log('Migration done');
  process.exit(0);
}
migrate();
