const router = require('express').Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const { rows: [caixaAberto] } = await pool.query("SELECT * FROM caixa WHERE status='aberto' ORDER BY data_abertura DESC LIMIT 1");
  let movimentacoes = [];
  if (caixaAberto) {
    const { rows } = await pool.query('SELECT * FROM movimentacoes_caixa WHERE caixa_id=$1 ORDER BY criado_em DESC', [caixaAberto.id]);
    movimentacoes = rows;
  }
  const totalEntradas = movimentacoes.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
  const totalSaidas = movimentacoes.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
  res.render('caixa/index', { caixa: caixaAberto, movimentacoes, totalEntradas, totalSaidas });
});

router.post('/abrir', async (req, res) => {
  const { valor_abertura } = req.body;
  const { rows: [existente] } = await pool.query("SELECT id FROM caixa WHERE status='aberto'");
  if (existente) return res.redirect('/caixa');
  await pool.query('INSERT INTO caixa (usuario_id, valor_abertura) VALUES ($1,$2)', [req.session.user.id, valor_abertura || 0]);
  res.redirect('/caixa');
});

router.post('/fechar', async (req, res) => {
  const { rows: [caixa] } = await pool.query("SELECT * FROM caixa WHERE status='aberto' ORDER BY data_abertura DESC LIMIT 1");
  if (!caixa) return res.redirect('/caixa');
  const { rows: movs } = await pool.query('SELECT * FROM movimentacoes_caixa WHERE caixa_id=$1', [caixa.id]);
  const entradas = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
  const saidas = movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
  const valorFechamento = Number(caixa.valor_abertura) + entradas - saidas;
  await pool.query("UPDATE caixa SET status='fechado', data_fechamento=NOW(), valor_fechamento=$1 WHERE id=$2", [valorFechamento, caixa.id]);
  res.redirect('/caixa');
});

router.post('/movimentacao', async (req, res) => {
  const { tipo, categoria, descricao, valor, forma_pagamento } = req.body;
  const { rows: [caixa] } = await pool.query("SELECT id FROM caixa WHERE status='aberto' ORDER BY data_abertura DESC LIMIT 1");
  if (!caixa) return res.redirect('/caixa');
  await pool.query('INSERT INTO movimentacoes_caixa (caixa_id,tipo,categoria,descricao,valor,forma_pagamento,referencia_tipo) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [caixa.id, tipo, categoria || null, descricao, valor, forma_pagamento || null, 'manual']);
  res.redirect('/caixa');
});

router.get('/historico', async (req, res) => {
  const { rows } = await pool.query(`SELECT c.*, u.nome as usuario_nome FROM caixa c
    LEFT JOIN usuarios u ON c.usuario_id=u.id ORDER BY c.data_abertura DESC LIMIT 30`);
  res.render('caixa/historico', { caixas: rows });
});

module.exports = router;
