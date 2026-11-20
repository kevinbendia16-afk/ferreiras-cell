const router = require('express').Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT v.*, u.nome as vendedor_nome, c.nome as cliente_nome,
    (SELECT string_agg(p.nome || ' x' || vi.quantidade, ', ')
     FROM venda_itens vi JOIN produtos p ON vi.produto_id=p.id WHERE vi.venda_id=v.id) as itens_desc
    FROM vendas v
    LEFT JOIN usuarios u ON v.usuario_id=u.id
    LEFT JOIN clientes c ON v.cliente_id=c.id
    ORDER BY v.criado_em DESC LIMIT 50
  `);
  res.render('vendas/index', { vendas: rows });
});

router.get('/:id', async (req, res) => {
  const { rows: [venda] } = await pool.query(
    `SELECT v.*, u.nome as vendedor_nome, c.nome as cliente_nome
     FROM vendas v LEFT JOIN usuarios u ON v.usuario_id=u.id
     LEFT JOIN clientes c ON v.cliente_id=c.id WHERE v.id=$1`, [req.params.id]);
  if (!venda) return res.redirect('/vendas');
  const { rows: itens } = await pool.query(
    'SELECT vi.*, p.nome as produto_nome FROM venda_itens vi JOIN produtos p ON vi.produto_id=p.id WHERE vi.venda_id=$1', [req.params.id]);
  res.render('vendas/show', { venda, itens });
});

module.exports = router;
