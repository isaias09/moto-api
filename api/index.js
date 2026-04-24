const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
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
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Demasiadas solicitudes. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(express.json({ limit: '2mb' }));

// ── RUTAS ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('../src/routes/auth'));
app.use('/api/empresa',    require('../src/routes/empresa'));
app.use('/api/clientes',   require('../src/routes/clientes'));
app.use('/api/prestamos',  require('../src/routes/prestamos'));
app.use('/api/pagos',      require('../src/routes/pagos'));
app.use('/api/usuarios',   require('../src/routes/usuarios'));
app.use('/api/reportes',   require('../src/routes/reportes'));
app.use('/api/superadmin', require('../src/routes/superadmin'));

app.get('/',           (_, res) => res.json({ app: 'FinanceRD API', version: '1.1.0' }));
app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date() }));

// ── MANEJO DE ERRORES GLOBAL ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) console.error('[error]', err.stack);
  const status = err.status ?? 500;
  res.status(status).json({
    error: isProd && status === 500
      ? 'Error interno del servidor'
      : err.message,
  });
});

// ── CONEXIÓN MONGODB (cache para serverless) ──────────────────────────────────
let conn = null;

async function connectDB() {
  if (conn && mongoose.connection.readyState === 1) return conn;
  conn = await mongoose.connect(process.env.MONGODB_URI, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 15000,
  });
  return conn;
}

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    return res.status(500).json({ error: 'Database connection failed' });
  }
  return app(req, res);
};
