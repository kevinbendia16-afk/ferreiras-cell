require('dotenv').config();
const fs = require('fs');
const pool = require('./db');

async function migrate() {
  console.log('Executando migração financeiro...');
  const sql = fs.readFileSync('./migrate-financeiro.sql', 'utf8');
  await pool.query(sql);
  console.log('Migração concluída!');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
