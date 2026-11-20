const router = require('express').Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const tipo = req.query.tipo || '';
  const status = req.query.status || '';
  let query = 'SELECT * FROM contas WHERE 1=1';
  const params = [];
  let idx = 1;
  if (tipo) { query += ` AND tipo=$${idx++}`; params.push(tipo); }
  if (status) { query += ` AND status=$${idx++}`; params.push(status); }
  query += ' ORDER BY data_vencimento ASC';
  const { rows } = await pool.query(query, params);
  res.render('financeiro/index', { contas: rows, tipo, status });
});

router.get('/nova', (req, res) => res.render('financeiro/form', { conta: null, error: null }));

router.post('/', async (req, res) => {
  const { tipo, descricao, valor, data_vencimento, categoria, observacoes } = req.body;
  await pool.query('INSERT INTO contas (tipo,descricao,valor,data_vencimento,categoria,observacoes) VALUES ($1,$2,$3,$4,$5,$6)',
    [tipo, descricao, valor, data_vencimento || null, categoria || null, observacoes || null]);
  res.redirect('/financeiro');
});

router.get('/:id/editar', async (req, res) => {
  const { rows: [conta] } = await pool.query('SELECT * FROM contas WHERE id=$1', [req.params.id]);
  if (!conta) return res.redirect('/financeiro');
  res.render('financeiro/form', { conta, error: null });
});

router.post('/:id', async (req, res) => {
  const { tipo, descricao, valor, data_vencimento, status, data_pagamento, categoria, observacoes } = req.body;
  await pool.query('UPDATE contas SET tipo=$1,descricao=$2,valor=$3,data_vencimento=$4,status=$5,data_pagamento=$6,categoria=$7,observacoes=$8 WHERE id=$9',
    [tipo, descricao, valor, data_vencimento || null, status, data_pagamento || null, categoria || null, observacoes || null, req.params.id]);
  res.redirect('/financeiro');
});

router.post('/:id/pagar', async (req, res) => {
  await pool.query("UPDATE contas SET status='pago', data_pagamento=CURRENT_DATE WHERE id=$1", [req.params.id]);
  res.redirect('/financeiro');
});

module.exports = router;
