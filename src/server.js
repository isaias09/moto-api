require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '*').split(',').map(o => o.trim());
app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());

// ── RATE LIMITING ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 200,
  message: { error: 'Demasiadas solicitudes. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter);
app.use('/api', generalLimiter);

app.use(express.json({ limit: '2mb' }));

// Rutas
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/clientes',  require('./routes/clientes'));
app.use('/api/prestamos', require('./routes/prestamos'));
app.use('/api/pagos',     require('./routes/pagos'));
app.use('/api/usuarios',  require('./routes/usuarios'));
app.use('/api/reportes',  require('./routes/reportes'));
app.use('/api/superadmin',require('./routes/superadmin'));

app.get('/',          (_, res) => res.json({ app: 'FinanceRD API', version: '1.0.0' }));
app.get('/api/health',(_, res) => res.json({ ok: true, time: new Date() }));

// Manejo de errores global
app.use((err, req, res, next) => {
  // No exponer stack traces en producción
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) console.error(err.stack);
  res.status(err.status ?? 500).json({
    error: isProd && err.status !== 400 && err.status !== 401 && err.status !== 403 && err.status !== 404
      ? 'Error interno del servidor'
      : err.message,
  });
});

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB conectado');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API en http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Error MongoDB:', err.message);
    process.exit(1);
  });
