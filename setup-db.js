require('dotenv').config();
const fs = require('fs');
const bcrypt = require('bcryptjs');
const pool = require('./db');

async function setup() {
  console.log('Criando tabelas...');
  let schema = fs.readFileSync('./schema.sql', 'utf8');
  const hash = await bcrypt.hash('admin123', 10);
  schema = schema.replace('$2a$10$placeholder', hash);
  await pool.query(schema);
  console.log('Tabelas criadas!');

  console.log('Inserindo produtos...');
  const seed = fs.readFileSync('./seed-produtos.sql', 'utf8');
  await pool.query(seed);
  console.log('Produtos inseridos!');

  console.log('Setup completo! Login: admin@ferreirascell.com / admin123');
  process.exit(0);
}

setup().catch(err => { console.error(err); process.exit(1); });
