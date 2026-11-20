require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const path = require('path');
const pool = require('./db');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new PgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'ferreiras-cell-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

const authMiddleware = require('./middlewares/auth');

app.use('/', require('./routes/auth'));
app.use('/dashboard', authMiddleware, require('./routes/dashboard'));
app.use('/clientes', authMiddleware, require('./routes/clientes'));
app.use('/ordens', authMiddleware, require('./routes/ordens'));
app.use('/estoque', authMiddleware, require('./routes/estoque'));
app.use('/caixa', authMiddleware, require('./routes/caixa'));
app.use('/financeiro', authMiddleware, require('./routes/financeiro'));
app.use('/pdv', authMiddleware, require('./routes/pdv'));
app.use('/configuracoes', authMiddleware, require('./routes/configuracoes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Ferreira's Cell rodando na porta ${PORT}`));
