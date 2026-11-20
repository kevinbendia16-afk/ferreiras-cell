const router = require('express').Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const mesInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const mesFim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

    const [osAbertas, osHoje, faturamentoHoje, estoqueBaixo, totalClientes, faturamentoMesRes, osEntreguesRes, ticketMedioRes] = await Promise.all([
      pool.query("SELECT COUNT(*) as total FROM ordens_servico WHERE status NOT IN ('entregue','cancelada')"),
      pool.query("SELECT COUNT(*) as total FROM ordens_servico WHERE DATE(criado_em)=$1", [hoje]),
      pool.query(`SELECT COALESCE(SUM(valor),0) as total FROM movimentacoes_caixa mc
        JOIN caixa c ON mc.caixa_id=c.id WHERE DATE(mc.criado_em)=$1 AND mc.tipo='entrada'`, [hoje]),
      pool.query("SELECT COUNT(*) as total FROM produtos WHERE estoque_atual <= estoque_minimo AND estoque_atual >= 0"),
      pool.query("SELECT COUNT(*) as total FROM clientes"),
      pool.query("SELECT COALESCE(SUM(valor),0) as total FROM contas WHERE tipo='receber' AND status='pago' AND data_pagamento BETWEEN $1 AND $2", [mesInicio, mesFim]),
      pool.query("SELECT COUNT(*) as total FROM ordens_servico WHERE status='entregue' AND criado_em::date BETWEEN $1 AND $2", [mesInicio, mesFim]),
      pool.query("SELECT COALESCE(AVG(valor_total),0) as media FROM ordens_servico WHERE status='entregue' AND valor_total > 0 AND criado_em::date BETWEEN $1 AND $2", [mesInicio, mesFim])
    ]);
    const ultimasOS = await pool.query(`SELECT os.*, c.nome as cliente_nome FROM ordens_servico os
      LEFT JOIN clientes c ON os.cliente_id=c.id ORDER BY os.criado_em DESC LIMIT 10`);

    res.render('dashboard/index', {
      stats: {
        osAbertas: osAbertas.rows[0].total,
        osHoje: osHoje.rows[0].total,
        faturamentoHoje: faturamentoHoje.rows[0].total,
        estoqueBaixo: estoqueBaixo.rows[0].total,
        totalClientes: totalClientes.rows[0].total,
        faturamentoMes: faturamentoMesRes.rows[0].total,
        osEntregues: osEntreguesRes.rows[0].total,
        ticketMedio: ticketMedioRes.rows[0].media
      },
      ultimasOS: ultimasOS.rows
    });
  } catch (err) {
    console.error(err);
    res.render('dashboard/index', { stats: {}, ultimasOS: [] });
  }
});

module.exports = router;
