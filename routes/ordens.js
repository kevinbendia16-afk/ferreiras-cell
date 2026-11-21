const router = require('express').Router();
const pool = require('../db');

async function gerarNumeroOS() {
  const ano = new Date().getFullYear();
  const { rows } = await pool.query("SELECT COUNT(*) as total FROM ordens_servico WHERE numero LIKE $1", [`OS${ano}%`]);
  const seq = String(Number(rows[0].total) + 1).padStart(5, '0');
  return `OS${ano}${seq}`;
}

router.get('/', async (req, res) => {
  const status = req.query.status || '';
  const busca = req.query.busca || '';
  let query = `SELECT os.*, c.nome as cliente_nome, u.nome as tecnico_nome
    FROM ordens_servico os
    LEFT JOIN clientes c ON os.cliente_id=c.id
    LEFT JOIN usuarios u ON os.tecnico_id=u.id WHERE 1=1`;
  const params = [];
  let idx = 1;
  if (status) { query += ` AND os.status=$${idx++}`; params.push(status); }
  if (busca) { query += ` AND (c.nome ILIKE $${idx} OR os.numero ILIKE $${idx} OR os.aparelho_modelo ILIKE $${idx})`; params.push(`%${busca}%`); idx++; }
  query += ' ORDER BY os.criado_em DESC';
  const { rows } = await pool.query(query, params);
  res.render('ordens/index', { ordens: rows, status, busca });
});

router.get('/nova', async (req, res) => {
  const { rows: clientes } = await pool.query('SELECT id, nome FROM clientes ORDER BY nome');
  const { rows: tecnicos } = await pool.query("SELECT id, nome FROM usuarios WHERE ativo=true AND papel IN ('admin','tecnico') ORDER BY nome");
  res.render('ordens/form', { os: null, clientes, tecnicos, error: null });
});

router.post('/', async (req, res) => {
  const { cliente_id, tecnico_id, aparelho_marca, aparelho_modelo, imei, defeito_relatado, data_previsao, observacoes, valor_servico, valor_sinal } = req.body;
  try {
    const numero = await gerarNumeroOS();
    const servico = Number(valor_servico || 0);
    const sinal = Number(valor_sinal || 0);
    const { rows } = await pool.query(
      `INSERT INTO ordens_servico (numero,cliente_id,tecnico_id,aparelho_marca,aparelho_modelo,imei,defeito_relatado,data_previsao,observacoes,valor_servico,valor_sinal,valor_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [numero, cliente_id, tecnico_id || null, aparelho_marca, aparelho_modelo, imei || null, defeito_relatado, data_previsao || null, observacoes || null, servico, sinal, servico]
    );
    // Sinal → caixa
    if (sinal > 0) {
      const { rows: [caixaAberto] } = await pool.query("SELECT id FROM caixa WHERE status='aberto' LIMIT 1");
      if (caixaAberto) {
        await pool.query(
          'INSERT INTO movimentacoes_caixa (caixa_id,tipo,categoria,descricao,valor,forma_pagamento,referencia_tipo,referencia_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [caixaAberto.id, 'entrada', 'Sinal OS', `Sinal OS ${numero}`, sinal, 'Pix', 'os', rows[0].id]
        );
      }
      await pool.query(
        "INSERT INTO contas (tipo,descricao,valor,data_vencimento,status,data_pagamento,categoria) VALUES ('receber',$1,$2,CURRENT_DATE,'pago',CURRENT_DATE,'Sinal OS')",
        [`Sinal OS ${numero}`, sinal]
      );
    }
    res.redirect(`/ordens/${rows[0].id}`);
  } catch (err) {
    console.error(err);
    const { rows: clientes } = await pool.query('SELECT id, nome FROM clientes ORDER BY nome');
    const { rows: tecnicos } = await pool.query("SELECT id, nome FROM usuarios WHERE ativo=true AND papel IN ('admin','tecnico') ORDER BY nome");
    res.render('ordens/form', { os: req.body, clientes, tecnicos, error: 'Erro ao salvar' });
  }
});

router.get('/:id', async (req, res) => {
  const { rows: [os] } = await pool.query(`SELECT os.*, c.nome as cliente_nome, c.telefone as cliente_telefone, u.nome as tecnico_nome
    FROM ordens_servico os LEFT JOIN clientes c ON os.cliente_id=c.id LEFT JOIN usuarios u ON os.tecnico_id=u.id WHERE os.id=$1`, [req.params.id]);
  if (!os) return res.redirect('/ordens');
  const { rows: pecas } = await pool.query(`SELECT op.*, p.nome as produto_nome FROM os_pecas op JOIN produtos p ON op.produto_id=p.id WHERE op.ordem_id=$1`, [req.params.id]);
  const { rows: produtos } = await pool.query("SELECT id, nome, preco_venda, estoque_atual FROM produtos WHERE estoque_atual > 0 ORDER BY nome");
  res.render('ordens/show', { os, pecas, produtos });
});

router.get('/:id/editar', async (req, res) => {
  const { rows: [os] } = await pool.query('SELECT * FROM ordens_servico WHERE id=$1', [req.params.id]);
  if (!os) return res.redirect('/ordens');
  const { rows: clientes } = await pool.query('SELECT id, nome FROM clientes ORDER BY nome');
  const { rows: tecnicos } = await pool.query("SELECT id, nome FROM usuarios WHERE ativo=true AND papel IN ('admin','tecnico') ORDER BY nome");
  res.render('ordens/form', { os, clientes, tecnicos, error: null });
});

router.post('/:id', async (req, res) => {
  const { cliente_id, tecnico_id, aparelho_marca, aparelho_modelo, imei, defeito_relatado, diagnostico, solucao, status, valor_servico, valor_sinal, forma_pagamento, data_previsao, observacoes } = req.body;

  const { rows: [osAtual] } = await pool.query('SELECT * FROM ordens_servico WHERE id=$1', [req.params.id]);

  const updates = { cliente_id, tecnico_id: tecnico_id || null, aparelho_marca, aparelho_modelo, imei: imei || null, defeito_relatado, diagnostico: diagnostico || null, solucao: solucao || null, status, valor_servico: valor_servico || 0, valor_sinal: valor_sinal || 0, forma_pagamento: forma_pagamento || null, data_previsao: data_previsao || null, observacoes: observacoes || null };
  if (status === 'pronto' || status === 'entregue') updates.data_conclusao = new Date();
  if (status === 'entregue') updates.data_entrega = new Date();

  const { rows: pecasOS } = await pool.query('SELECT COALESCE(SUM(subtotal),0) as total FROM os_pecas WHERE ordem_id=$1', [req.params.id]);
  updates.valor_pecas = pecasOS[0].total;
  updates.valor_total = Number(updates.valor_servico) + Number(updates.valor_pecas);

  const cols = Object.keys(updates);
  const vals = Object.values(updates);
  const setClause = cols.map((c, i) => `${c}=$${i + 1}`).join(',');
  await pool.query(`UPDATE ordens_servico SET ${setClause} WHERE id=$${cols.length + 1}`, [...vals, req.params.id]);

  if (status === 'entregue' && osAtual && osAtual.status !== 'entregue') {
    const totalOS = Number(updates.valor_total);
    const sinalPago = Number(updates.valor_sinal || 0);
    const restante = totalOS - sinalPago;
    if (restante > 0) {
      await pool.query(
        "INSERT INTO contas (tipo,descricao,valor,data_vencimento,status,data_pagamento,categoria) VALUES ('receber',$1,$2,CURRENT_DATE,'pago',CURRENT_DATE,'Ordem de Serviço')",
        [`OS ${osAtual.numero} - ${aparelho_marca} ${aparelho_modelo}`, restante]
      );
      const { rows: [caixaAberto] } = await pool.query("SELECT id FROM caixa WHERE status='aberto' LIMIT 1");
      if (caixaAberto) {
        await pool.query(
          'INSERT INTO movimentacoes_caixa (caixa_id,tipo,categoria,descricao,valor,forma_pagamento,referencia_tipo,referencia_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [caixaAberto.id, 'entrada', 'Ordem de Serviço', `OS ${osAtual.numero} (restante)`, restante, forma_pagamento || 'Pix', 'os', req.params.id]
        );
      }
    }
  }

  res.redirect(`/ordens/${req.params.id}`);
});

// Status rápido (botões na show)
router.post('/:id/status', async (req, res) => {
  const { status } = req.body;
  const valid = ['aberta','aguardando_peca','em_reparo','pronto','entregue','cancelada'];
  if (!valid.includes(status)) return res.redirect(`/ordens/${req.params.id}`);

  const { rows: [osAtual] } = await pool.query('SELECT * FROM ordens_servico WHERE id=$1', [req.params.id]);
  if (!osAtual) return res.redirect('/ordens');

  const updates = { status };
  if (status === 'pronto' || status === 'entregue') updates.data_conclusao = new Date();
  if (status === 'entregue') updates.data_entrega = new Date();

  const cols = Object.keys(updates);
  const vals = Object.values(updates);
  await pool.query(`UPDATE ordens_servico SET ${cols.map((c,i)=>`${c}=$${i+1}`).join(',')} WHERE id=$${cols.length+1}`, [...vals, req.params.id]);

  if (status === 'entregue' && osAtual.status !== 'entregue') {
    const totalOS = Number(osAtual.valor_total || 0);
    const sinalPago = Number(osAtual.valor_sinal || 0);
    const restante = totalOS - sinalPago;
    if (restante > 0) {
      await pool.query(
        "INSERT INTO contas (tipo,descricao,valor,data_vencimento,status,data_pagamento,categoria) VALUES ('receber',$1,$2,CURRENT_DATE,'pago',CURRENT_DATE,'Ordem de Serviço')",
        [`OS ${osAtual.numero} - ${osAtual.aparelho_marca} ${osAtual.aparelho_modelo}`, restante]
      );
      const { rows: [caixaAberto] } = await pool.query("SELECT id FROM caixa WHERE status='aberto' LIMIT 1");
      if (caixaAberto) {
        await pool.query(
          'INSERT INTO movimentacoes_caixa (caixa_id,tipo,categoria,descricao,valor,forma_pagamento,referencia_tipo,referencia_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [caixaAberto.id, 'entrada', 'Ordem de Serviço', `OS ${osAtual.numero} (restante)`, restante, osAtual.forma_pagamento || 'Pix', 'os', req.params.id]
        );
      }
    }
  }
  res.redirect(`/ordens/${req.params.id}`);
});

router.post('/:id/pecas', async (req, res) => {
  const { produto_id, quantidade } = req.body;
  const { rows: [prod] } = await pool.query('SELECT preco_venda, preco_custo, estoque_atual FROM produtos WHERE id=$1', [produto_id]);
  if (!prod || prod.estoque_atual < quantidade) {
    return res.redirect(`/ordens/${req.params.id}?error=Estoque insuficiente`);
  }
  const subtotal = prod.preco_venda * quantidade;
  const custoUnit = Number(prod.preco_custo || 0);
  await pool.query('INSERT INTO os_pecas (ordem_id,produto_id,quantidade,preco_unitario,preco_custo,subtotal) VALUES ($1,$2,$3,$4,$5,$6)',
    [req.params.id, produto_id, quantidade, prod.preco_venda, custoUnit, subtotal]);
  await pool.query('UPDATE produtos SET estoque_atual=estoque_atual-$1 WHERE id=$2', [quantidade, produto_id]);
  const { rows: pecasOS } = await pool.query('SELECT COALESCE(SUM(subtotal),0) as total_venda, COALESCE(SUM(preco_custo*quantidade),0) as total_custo FROM os_pecas WHERE ordem_id=$1', [req.params.id]);
  await pool.query('UPDATE ordens_servico SET valor_pecas=$1, custo_pecas=$2, valor_total=valor_servico+$1 WHERE id=$3', [pecasOS[0].total_venda, pecasOS[0].total_custo, req.params.id]);
  res.redirect(`/ordens/${req.params.id}`);
});

router.post('/:id/pecas/:pecaId/remover', async (req, res) => {
  const { rows: [peca] } = await pool.query('SELECT * FROM os_pecas WHERE id=$1', [req.params.pecaId]);
  if (peca) {
    await pool.query('UPDATE produtos SET estoque_atual=estoque_atual+$1 WHERE id=$2', [peca.quantidade, peca.produto_id]);
    await pool.query('DELETE FROM os_pecas WHERE id=$1', [req.params.pecaId]);
    const { rows: pecasOS } = await pool.query('SELECT COALESCE(SUM(subtotal),0) as total_venda, COALESCE(SUM(preco_custo*quantidade),0) as total_custo FROM os_pecas WHERE ordem_id=$1', [req.params.id]);
    await pool.query('UPDATE ordens_servico SET valor_pecas=$1, custo_pecas=$2, valor_total=valor_servico+$1 WHERE id=$3', [pecasOS[0].total_venda, pecasOS[0].total_custo, req.params.id]);
  }
  res.redirect(`/ordens/${req.params.id}`);
});

module.exports = router;
