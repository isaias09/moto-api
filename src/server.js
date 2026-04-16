require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors()); // preflight
app.use(express.json({ limit: '10mb' }));

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
  console.error(err.stack);
  res.status(500).json({ error: err.message });
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
