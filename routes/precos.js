const router = require('express').Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const busca = req.query.busca || '';
  let query = `SELECT p.id, p.nome, p.preco_custo, p.preco_venda, p.estoque_atual, COALESCE(c.nome,'') as categoria
    FROM produtos p LEFT JOIN categorias_produto c ON p.categoria_id=c.id WHERE 1=1`;
  const params = [];
  if (busca) {
    query += ' AND (p.nome ILIKE $1 OR c.nome ILIKE $1)';
    params.push(`%${busca}%`);
  }
  query += ' ORDER BY p.nome';
  const { rows } = await pool.query(query, params);
  res.render('precos/index', { produtos: rows, busca });
});

module.exports = router;
