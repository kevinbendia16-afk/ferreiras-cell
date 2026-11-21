const router = require('express').Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const { rows: ordens } = await pool.query(`
    SELECT os.*, c.nome as cliente_nome, u.nome as tecnico_nome
    FROM ordens_servico os
    LEFT JOIN clientes c ON os.cliente_id=c.id
    LEFT JOIN usuarios u ON os.tecnico_id=u.id
    WHERE os.status NOT IN ('entregue','cancelada')
    ORDER BY COALESCE(os.data_previsao, '2099-12-31'), os.criado_em
  `);
  res.render('agenda/index', { ordens });
});

module.exports = router;
