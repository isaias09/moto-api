const mongoose = require('mongoose');
const Usuario  = require('./models/Usuario');
const Empresa  = require('./models/Empresa');
require('dotenv').config();

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a MongoDB');

  // ── SuperAdmin ────────────────────────────────────────────────────────────
  let superAdmin = await Usuario.findOne({ esSuperAdmin: true });
  if (!superAdmin) {
    superAdmin = await Usuario.create({
      nombre:       'Super Administrador',
      email:        'superadmin@financerd.com',
      password:     'Super2024!',
      rol:          'admin',
      esSuperAdmin: true,
      activo:       true,
    });
    console.log('✅ SuperAdmin: superadmin@financerd.com / Super2024!');
  } else {
    console.log('ℹ️  SuperAdmin ya existe');
  }

  // ── Empresa demo ──────────────────────────────────────────────────────────
  let empresa = await Empresa.findOne({ nombre: 'FinanceRD Demo' });
  if (!empresa) {
    empresa = await Empresa.create({
      nombre:    'FinanceRD Demo',
      rnc:       '1-23-45678-9',
      telefono:  '809-555-0100',
      direccion: 'Av. 27 de Febrero #123, Santo Domingo',
      email:     'demo@financerd.com',
      activa:    true,
      plan:      'profesional',
      config: {
        moneda:                'RD$',
        tasaInteresMensual:    5,
        tasaMora:              0.5,
        diasGraciaMora:        3,
        frecuenciaPagoDefault: 'mensual',
      },
      creadoPor: superAdmin._id,
    });
    console.log('✅ Empresa demo creada:', empresa._id);
  }

  // ── Admin de la empresa demo ──────────────────────────────────────────────
  const adminExiste = await Usuario.findOne({ email: 'admin@financerd.com' });
  if (!adminExiste) {
    await Usuario.create({
      empresaId:    empresa._id,
      nombre:       'Administrador',
      email:        'admin@financerd.com',
      password:     'admin123',
      rol:          'admin',
      esSuperAdmin: false,
      activo:       true,
    });
    console.log('✅ Admin empresa: admin@financerd.com / admin123');
  }

  await mongoose.disconnect();
  console.log('✅ Seed completado');
}

seed().catch(console.error);
