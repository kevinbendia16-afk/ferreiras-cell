const router = require('express').Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const { rows: produtos } = await pool.query(`SELECT p.*, cp.nome as categoria_nome FROM produtos p
    LEFT JOIN categorias_produto cp ON p.categoria_id=cp.id WHERE p.estoque_atual > 0 ORDER BY cp.nome, p.nome`);
  const { rows: clientes } = await pool.query('SELECT id, nome FROM clientes ORDER BY nome');
  res.render('pdv/index', { produtos, clientes });
});

router.post('/vender', async (req, res) => {
  const { cliente_id, forma_pagamento, itens } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let valorTotal = 0;
    const parsedItens = JSON.parse(itens);

    const { rows: [venda] } = await client.query(
      'INSERT INTO vendas (cliente_id, usuario_id, forma_pagamento) VALUES ($1,$2,$3) RETURNING id',
      [cliente_id || null, req.session.user.id, forma_pagamento]
    );

    for (const item of parsedItens) {
      const { rows: [prod] } = await client.query('SELECT preco_venda, estoque_atual FROM produtos WHERE id=$1', [item.produto_id]);
      if (!prod || prod.estoque_atual < item.quantidade) throw new Error(`Estoque insuficiente: ${item.produto_id}`);
      const subtotal = prod.preco_venda * item.quantidade;
      valorTotal += subtotal;
      await client.query('INSERT INTO venda_itens (venda_id,produto_id,quantidade,preco_unitario,subtotal) VALUES ($1,$2,$3,$4,$5)',
        [venda.id, item.produto_id, item.quantidade, prod.preco_venda, subtotal]);
      await client.query('UPDATE produtos SET estoque_atual=estoque_atual-$1 WHERE id=$2', [item.quantidade, item.produto_id]);
    }

    await client.query('UPDATE vendas SET valor_total=$1 WHERE id=$2', [valorTotal, venda.id]);

    const { rows: [caixaAberto] } = await client.query("SELECT id FROM caixa WHERE status='aberto' ORDER BY data_abertura DESC LIMIT 1");
    if (caixaAberto) {
      await client.query('INSERT INTO movimentacoes_caixa (caixa_id,tipo,categoria,descricao,valor,forma_pagamento,referencia_tipo,referencia_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [caixaAberto.id, 'entrada', 'Venda balcão', `Venda #${venda.id}`, valorTotal, forma_pagamento, 'venda', venda.id]);
    }

    await client.query('COMMIT');
    res.json({ ok: true, venda_id: venda.id, valor_total: valorTotal });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
