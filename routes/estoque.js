const router = require('express').Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const categoria = req.query.categoria || '';
  const busca = req.query.busca || '';
  let query = `SELECT p.*, cp.nome as categoria_nome, cp.tipo as categoria_tipo FROM produtos p
    LEFT JOIN categorias_produto cp ON p.categoria_id=cp.id WHERE 1=1`;
  const params = [];
  let idx = 1;
  if (categoria) { query += ` AND p.categoria_id=$${idx++}`; params.push(categoria); }
  if (busca) { query += ` AND p.nome ILIKE $${idx++}`; params.push(`%${busca}%`); }
  query += ' ORDER BY cp.nome, p.nome';
  const { rows: produtos } = await pool.query(query, params);
  const { rows: categorias } = await pool.query('SELECT * FROM categorias_produto ORDER BY tipo, nome');
  res.render('estoque/index', { produtos, categorias, categoria, busca });
});

router.get('/novo', async (req, res) => {
  const { rows: categorias } = await pool.query('SELECT * FROM categorias_produto ORDER BY tipo, nome');
  res.render('estoque/form', { produto: null, categorias, error: null });
});

router.post('/', async (req, res) => {
  const { nome, categoria_id, preco_custo, preco_venda, estoque_atual, estoque_minimo, codigo_barras } = req.body;
  try {
    await pool.query('INSERT INTO produtos (nome,categoria_id,preco_custo,preco_venda,estoque_atual,estoque_minimo,codigo_barras) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [nome, categoria_id, preco_custo || 0, preco_venda || 0, estoque_atual || 0, estoque_minimo || 1, codigo_barras || null]);
    res.redirect('/estoque');
  } catch (err) {
    console.error(err);
    const { rows: categorias } = await pool.query('SELECT * FROM categorias_produto ORDER BY tipo, nome');
    res.render('estoque/form', { produto: req.body, categorias, error: 'Erro ao salvar' });
  }
});

router.get('/:id/editar', async (req, res) => {
  const { rows: [produto] } = await pool.query('SELECT * FROM produtos WHERE id=$1', [req.params.id]);
  if (!produto) return res.redirect('/estoque');
  const { rows: categorias } = await pool.query('SELECT * FROM categorias_produto ORDER BY tipo, nome');
  res.render('estoque/form', { produto, categorias, error: null });
});

router.post('/:id', async (req, res) => {
  const { nome, categoria_id, preco_custo, preco_venda, estoque_atual, estoque_minimo, codigo_barras } = req.body;
  await pool.query('UPDATE produtos SET nome=$1,categoria_id=$2,preco_custo=$3,preco_venda=$4,estoque_atual=$5,estoque_minimo=$6,codigo_barras=$7 WHERE id=$8',
    [nome, categoria_id, preco_custo || 0, preco_venda || 0, estoque_atual || 0, estoque_minimo || 1, codigo_barras || null, req.params.id]);
  res.redirect('/estoque');
});

router.post('/:id/entrada', async (req, res) => {
  const qtd = Number(req.body.quantidade);
  if (qtd > 0) await pool.query('UPDATE produtos SET estoque_atual=estoque_atual+$1 WHERE id=$2', [qtd, req.params.id]);
  res.redirect('/estoque');
});

router.get('/categorias', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM categorias_produto ORDER BY tipo, nome');
  res.render('estoque/categorias', { categorias: rows });
});

router.post('/categorias', async (req, res) => {
  const { nome, tipo } = req.body;
  await pool.query('INSERT INTO categorias_produto (nome, tipo) VALUES ($1,$2)', [nome, tipo]);
  res.redirect('/estoque/categorias');
});

module.exports = router;
