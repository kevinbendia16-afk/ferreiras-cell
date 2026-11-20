const router = require('express').Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const busca = req.query.busca || '';
  let query = 'SELECT * FROM clientes';
  const params = [];
  if (busca) {
    query += ' WHERE nome ILIKE $1 OR telefone ILIKE $1 OR cpf ILIKE $1';
    params.push(`%${busca}%`);
  }
  query += ' ORDER BY nome';
  const { rows } = await pool.query(query, params);
  res.render('clientes/index', { clientes: rows, busca });
});

router.get('/novo', (req, res) => res.render('clientes/form', { cliente: null, error: null }));

router.post('/', async (req, res) => {
  const { nome, telefone, email, cpf, endereco, observacoes } = req.body;
  try {
    await pool.query('INSERT INTO clientes (nome,telefone,email,cpf,endereco,observacoes) VALUES ($1,$2,$3,$4,$5,$6)',
      [nome, telefone, email || null, cpf || null, endereco || null, observacoes || null]);
    res.redirect('/clientes');
  } catch (err) {
    console.error(err);
    res.render('clientes/form', { cliente: req.body, error: 'Erro ao salvar' });
  }
});

router.get('/:id/editar', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clientes WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.redirect('/clientes');
  res.render('clientes/form', { cliente: rows[0], error: null });
});

router.post('/:id', async (req, res) => {
  const { nome, telefone, email, cpf, endereco, observacoes } = req.body;
  await pool.query('UPDATE clientes SET nome=$1,telefone=$2,email=$3,cpf=$4,endereco=$5,observacoes=$6 WHERE id=$7',
    [nome, telefone, email || null, cpf || null, endereco || null, observacoes || null, req.params.id]);
  res.redirect('/clientes');
});

router.get('/:id', async (req, res) => {
  const { rows: [cliente] } = await pool.query('SELECT * FROM clientes WHERE id=$1', [req.params.id]);
  if (!cliente) return res.redirect('/clientes');
  const { rows: ordens } = await pool.query('SELECT * FROM ordens_servico WHERE cliente_id=$1 ORDER BY criado_em DESC', [req.params.id]);
  const { rows: vendas } = await pool.query('SELECT * FROM vendas WHERE cliente_id=$1 ORDER BY criado_em DESC', [req.params.id]);
  res.render('clientes/show', { cliente, ordens, vendas });
});

module.exports = router;
