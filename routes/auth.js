const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE email=$1 AND ativo=true', [email]);
    if (!rows.length) return res.render('auth/login', { error: 'Email ou senha inválidos' });
    const valid = await bcrypt.compare(senha, rows[0].senha);
    if (!valid) return res.render('auth/login', { error: 'Email ou senha inválidos' });
    req.session.user = { id: rows[0].id, nome: rows[0].nome, email: rows[0].email, papel: rows[0].papel };
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('auth/login', { error: 'Erro interno' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

router.get('/', (req, res) => res.redirect('/dashboard'));

module.exports = router;
