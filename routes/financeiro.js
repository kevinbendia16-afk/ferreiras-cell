const router = require('express').Router();
const pool = require('../db');

// ─── Visão Geral (Dashboard Financeiro) ───
router.get('/', async (req, res) => {
  const mes = req.query.mes || new Date().toISOString().slice(0, 7);
  const [ano, m] = mes.split('-').map(Number);
  const inicio = mes + '-01';
  const fim = new Date(ano, m, 0).toISOString().slice(0, 10);

  const [receitasRes, despesasRes, contasPendRes, comprasPendRes, custosRes, ultimasContasRes] = await Promise.all([
    pool.query("SELECT COALESCE(SUM(valor),0) as total FROM contas WHERE tipo='receber' AND status='pago' AND data_pagamento BETWEEN $1 AND $2", [inicio, fim]),
    pool.query("SELECT COALESCE(SUM(valor),0) as total FROM contas WHERE tipo='pagar' AND status='pago' AND data_pagamento BETWEEN $1 AND $2", [inicio, fim]),
    pool.query("SELECT COUNT(*) as total FROM contas WHERE status='pendente'"),
    pool.query("SELECT COUNT(*) as total FROM compras WHERE status='pendente'"),
    pool.query("SELECT COALESCE(SUM(valor),0) as total FROM custos_fixos WHERE ativo=true"),
    pool.query("SELECT * FROM contas ORDER BY criado_em DESC LIMIT 10")
  ]);

  const comprasGastoRes = await pool.query("SELECT COALESCE(SUM(valor_total),0) as total FROM compras WHERE status='pago' AND data_pagamento BETWEEN $1 AND $2", [inicio, fim]);

  const receitas = Number(receitasRes.rows[0].total);
  const despesas = Number(despesasRes.rows[0].total) + Number(comprasGastoRes.rows[0].total);
  const lucro = receitas - despesas;

  res.render('financeiro/index', {
    mes,
    receitas,
    despesas,
    lucro,
    contasPendentes: Number(contasPendRes.rows[0].total),
    comprasPendentes: Number(comprasPendRes.rows[0].total),
    custosMensais: Number(custosRes.rows[0].total),
    ultimasContas: ultimasContasRes.rows
  });
});

// ─── Contas (a pagar / a receber) ───
router.get('/contas', async (req, res) => {
  const tipo = req.query.tipo || '';
  const status = req.query.status || '';
  let query = 'SELECT * FROM contas WHERE 1=1';
  const params = [];
  let idx = 1;
  if (tipo) { query += ` AND tipo=$${idx++}`; params.push(tipo); }
  if (status) { query += ` AND status=$${idx++}`; params.push(status); }
  query += ' ORDER BY data_vencimento ASC';
  const { rows } = await pool.query(query, params);
  res.render('financeiro/contas', { contas: rows, tipo, status });
});

router.get('/contas/nova', (req, res) => res.render('financeiro/conta-form', { conta: null, error: null }));

router.post('/contas', async (req, res) => {
  const { tipo, descricao, valor, data_vencimento, categoria, observacoes } = req.body;
  await pool.query('INSERT INTO contas (tipo,descricao,valor,data_vencimento,categoria,observacoes) VALUES ($1,$2,$3,$4,$5,$6)',
    [tipo, descricao, valor, data_vencimento || null, categoria || null, observacoes || null]);
  res.redirect('/financeiro/contas');
});

router.get('/contas/:id/editar', async (req, res) => {
  const { rows: [conta] } = await pool.query('SELECT * FROM contas WHERE id=$1', [req.params.id]);
  if (!conta) return res.redirect('/financeiro/contas');
  res.render('financeiro/conta-form', { conta, error: null });
});

router.post('/contas/:id', async (req, res) => {
  const { tipo, descricao, valor, data_vencimento, status, data_pagamento, categoria, observacoes } = req.body;
  await pool.query('UPDATE contas SET tipo=$1,descricao=$2,valor=$3,data_vencimento=$4,status=$5,data_pagamento=$6,categoria=$7,observacoes=$8 WHERE id=$9',
    [tipo, descricao, valor, data_vencimento || null, status, data_pagamento || null, categoria || null, observacoes || null, req.params.id]);
  res.redirect('/financeiro/contas');
});

router.post('/contas/:id/pagar', async (req, res) => {
  await pool.query("UPDATE contas SET status='pago', data_pagamento=CURRENT_DATE WHERE id=$1", [req.params.id]);
  res.redirect('/financeiro/contas');
});

// ─── Compras (fornecedores) ───
router.get('/compras', async (req, res) => {
  const status = req.query.status || '';
  let query = 'SELECT * FROM compras WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status=$1'; params.push(status); }
  query += ' ORDER BY data_compra DESC';
  const { rows } = await pool.query(query, params);
  res.render('financeiro/compras', { compras: rows, status });
});

router.get('/compras/nova', async (req, res) => {
  const { rows: produtos } = await pool.query('SELECT id,nome,preco_custo,estoque_atual FROM produtos ORDER BY nome');
  res.render('financeiro/compra-form', { compra: null, produtos, itens: [], error: null });
});

router.post('/compras', async (req, res) => {
  const { fornecedor, data_compra, forma_pagamento, observacoes, itens } = req.body;
  const parsedItens = JSON.parse(itens || '[]');
  const valorTotal = parsedItens.reduce((sum, i) => sum + (Number(i.preco_unitario) * Number(i.quantidade)), 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [compra] } = await client.query(
      'INSERT INTO compras (fornecedor,data_compra,forma_pagamento,valor_total,observacoes) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [fornecedor, data_compra || new Date(), forma_pagamento || null, valorTotal, observacoes || null]
    );
    for (const item of parsedItens) {
      const sub = Number(item.preco_unitario) * Number(item.quantidade);
      await client.query(
        'INSERT INTO compra_itens (compra_id,produto_id,quantidade,preco_unitario,subtotal) VALUES ($1,$2,$3,$4,$5)',
        [compra.id, item.produto_id, item.quantidade, item.preco_unitario, sub]
      );
    }
    await client.query('COMMIT');
    res.redirect('/financeiro/compras/' + compra.id);
  } catch (err) {
    await client.query('ROLLBACK');
    const { rows: produtos } = await pool.query('SELECT id,nome,preco_custo,estoque_atual FROM produtos ORDER BY nome');
    res.render('financeiro/compra-form', { compra: null, produtos, itens: [], error: err.message });
  } finally {
    client.release();
  }
});

router.get('/compras/:id', async (req, res) => {
  const { rows: [compra] } = await pool.query('SELECT * FROM compras WHERE id=$1', [req.params.id]);
  if (!compra) return res.redirect('/financeiro/compras');
  const { rows: itens } = await pool.query(
    'SELECT ci.*, p.nome as produto_nome FROM compra_itens ci LEFT JOIN produtos p ON ci.produto_id=p.id WHERE ci.compra_id=$1',
    [req.params.id]
  );
  res.render('financeiro/compra-show', { compra, itens });
});

router.post('/compras/:id/pagar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE compras SET status='pago', data_pagamento=CURRENT_DATE WHERE id=$1", [req.params.id]);
    const { rows: itens } = await client.query('SELECT produto_id, quantidade FROM compra_itens WHERE compra_id=$1', [req.params.id]);
    for (const item of itens) {
      await client.query('UPDATE produtos SET estoque_atual = estoque_atual + $1 WHERE id=$2', [item.quantidade, item.produto_id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
  res.redirect('/financeiro/compras/' + req.params.id);
});

router.post('/compras/:id/cancelar', async (req, res) => {
  await pool.query("UPDATE compras SET status='cancelado' WHERE id=$1", [req.params.id]);
  res.redirect('/financeiro/compras/' + req.params.id);
});

// ─── Custos Fixos ───
router.get('/custos', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM custos_fixos ORDER BY descricao');
  const totalMensal = rows.filter(c => c.ativo).reduce((sum, c) => sum + Number(c.valor), 0);
  res.render('financeiro/custos', { custos: rows, totalMensal });
});

router.post('/custos', async (req, res) => {
  const { descricao, valor, dia_vencimento, categoria } = req.body;
  await pool.query('INSERT INTO custos_fixos (descricao,valor,dia_vencimento,categoria) VALUES ($1,$2,$3,$4)',
    [descricao, valor, dia_vencimento || 1, categoria || null]);
  res.redirect('/financeiro/custos');
});

router.post('/custos/:id/toggle', async (req, res) => {
  await pool.query('UPDATE custos_fixos SET ativo = NOT ativo WHERE id=$1', [req.params.id]);
  res.redirect('/financeiro/custos');
});

router.post('/custos/:id/excluir', async (req, res) => {
  await pool.query('DELETE FROM custos_fixos WHERE id=$1', [req.params.id]);
  res.redirect('/financeiro/custos');
});

// ─── Relatórios ───
router.get('/relatorios', async (req, res) => {
  const de = req.query.de || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const ate = req.query.ate || new Date().toISOString().slice(0, 10);

  const [receitasRes, despesasRes, comprasRes, vendasRes, osRes] = await Promise.all([
    pool.query("SELECT COALESCE(SUM(valor),0) as total FROM contas WHERE tipo='receber' AND status='pago' AND data_pagamento BETWEEN $1 AND $2", [de, ate]),
    pool.query("SELECT COALESCE(SUM(valor),0) as total FROM contas WHERE tipo='pagar' AND status='pago' AND data_pagamento BETWEEN $1 AND $2", [de, ate]),
    pool.query("SELECT COALESCE(SUM(valor_total),0) as total, COUNT(*) as qtd FROM compras WHERE status='pago' AND data_pagamento BETWEEN $1 AND $2", [de, ate]),
    pool.query("SELECT COALESCE(SUM(valor_total),0) as total, COUNT(*) as qtd FROM vendas WHERE criado_em::date BETWEEN $1 AND $2", [de, ate]),
    pool.query("SELECT COALESCE(SUM(valor_total),0) as total, COUNT(*) as qtd FROM ordens_servico WHERE status='entregue' AND criado_em::date BETWEEN $1 AND $2", [de, ate])
  ]);

  const receitas = Number(receitasRes.rows[0].total);
  const despesas = Number(despesasRes.rows[0].total) + Number(comprasRes.rows[0].total);

  res.render('financeiro/relatorios', {
    de, ate,
    receitas,
    despesas,
    lucro: receitas - despesas,
    compras: comprasRes.rows[0],
    vendas: vendasRes.rows[0],
    os: osRes.rows[0]
  });
});

module.exports = router;
