const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const app = express();

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth',      require('../src/routes/auth'));
app.use('/api/clientes',  require('../src/routes/clientes'));
app.use('/api/prestamos', require('../src/routes/prestamos'));
app.use('/api/pagos',     require('../src/routes/pagos'));
app.use('/api/usuarios',  require('../src/routes/usuarios'));
app.use('/api/reportes',  require('../src/routes/reportes'));
app.get('/',           (_, res) => res.json({ app: 'FinanceRD API', v: '1.0.0' }));
app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date() }));

// Cache de conexión MongoDB para serverless
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
    return res.status(500).json({ error: 'Database connection failed', detail: err.message });
  }
  return app(req, res);
};
