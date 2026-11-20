const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');

function adminOnly(req, res, next) {
  if (req.session.user.papel !== 'admin') return res.redirect('/dashboard');
  next();
}

router.get('/', adminOnly, async (req, res) => {
  const { rows: usuarios } = await pool.query('SELECT id, nome, email, papel, ativo, criado_em FROM usuarios ORDER BY nome');
  res.render('configuracoes/index', { usuarios });
});

router.get('/usuarios/novo', adminOnly, (req, res) => {
  res.render('configuracoes/usuario-form', { usuario: null, error: null });
});

router.post('/usuarios', adminOnly, async (req, res) => {
  const { nome, email, senha, papel } = req.body;
  try {
    const hash = await bcrypt.hash(senha, 10);
    await pool.query('INSERT INTO usuarios (nome,email,senha,papel) VALUES ($1,$2,$3,$4)', [nome, email, hash, papel]);
    res.redirect('/configuracoes');
  } catch (err) {
    console.error(err);
    res.render('configuracoes/usuario-form', { usuario: req.body, error: 'Erro ao salvar (email já existe?)' });
  }
});

router.get('/usuarios/:id/editar', adminOnly, async (req, res) => {
  const { rows: [usuario] } = await pool.query('SELECT * FROM usuarios WHERE id=$1', [req.params.id]);
  if (!usuario) return res.redirect('/configuracoes');
  res.render('configuracoes/usuario-form', { usuario, error: null });
});

router.post('/usuarios/:id', adminOnly, async (req, res) => {
  const { nome, email, papel, ativo, senha } = req.body;
  if (senha) {
    const hash = await bcrypt.hash(senha, 10);
    await pool.query('UPDATE usuarios SET nome=$1,email=$2,papel=$3,ativo=$4,senha=$5 WHERE id=$6', [nome, email, papel, ativo === 'true', hash, req.params.id]);
  } else {
    await pool.query('UPDATE usuarios SET nome=$1,email=$2,papel=$3,ativo=$4 WHERE id=$5', [nome, email, papel, ativo === 'true', req.params.id]);
  }
  res.redirect('/configuracoes');
});

module.exports = router;
