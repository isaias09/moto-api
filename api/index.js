require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));

// Rutas
app.use('/api/auth',      require('../src/routes/auth'));
app.use('/api/clientes',  require('../src/routes/clientes'));
app.use('/api/prestamos', require('../src/routes/prestamos'));
app.use('/api/pagos',     require('../src/routes/pagos'));
app.use('/api/usuarios',  require('../src/routes/usuarios'));
app.use('/api/reportes',  require('../src/routes/reportes'));
app.get('/',              (_, res) => res.json({ app: 'FinanceRD API', version: '1.0.0' }));
app.get('/api/health',    (_, res) => res.json({ ok: true, time: new Date() }));

// Conexión MongoDB con cache (importante en serverless)
let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// Handler de Vercel
module.exports = async (req, res) => {
  await connectDB();
  return app(req, res);
};
