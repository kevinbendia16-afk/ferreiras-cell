const router = require('express').Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const busca = req.query.busca || '';
  let query = 'SELECT id, nome, preco_custo, preco_venda, estoque_atual, categoria FROM produtos WHERE 1=1';
  const params = [];
  if (busca) {
    query += ' AND (nome ILIKE $1 OR categoria ILIKE $1)';
    params.push(`%${busca}%`);
  }
  query += ' ORDER BY nome';
  const { rows } = await pool.query(query, params);
  res.render('precos/index', { produtos: rows, busca });
});

module.exports = router;
